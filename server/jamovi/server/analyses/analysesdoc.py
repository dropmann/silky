
from jamovi.server.jamovi_pb2 import AnalysisOptions
from jamovi.server.jamovi_pb2 import AnalysisStatus
import y_py as Y
import asyncio
import typing
import json
import asyncio
import binascii
from jamovi.server.utils.event import EventHook, Event
from .analyses import Analyses
if typing.TYPE_CHECKING:
    from jamovi.server.instancemodel import InstanceModel

ANALYSIS_COMPLETE = AnalysisStatus.Value('ANALYSIS_COMPLETE')

async def sync_ydoc_to_options(resources, target, ydoc_options_pb):
    analysis_element = target
    uuid = analysis_element.get_attribute('__uuid')
    resources[uuid]['revision'] += 1
    resources[uuid]['analysis'].set_options(ydoc_options_pb, [], resources[uuid]['revision'], True)

class AnalysesDoc:
    '''Analyses document'''

    _doc: Y.YDoc
    resources = {}
    _analyses: Analyses
    doc_changed: EventHook
    _txn = None
    _initialising_options = None
    _externalChanges = False

    def __init__(self, instance_model):
        self._doc = Y.YDoc()
        self._analyses = instance_model.analyses
        self._analyses.add_options_changed_listener(self._options_changed_handler)
        self._analyses.add_results_changed_listener(self._results_changed_handler)
        self._doc.observe_after_transaction(self.on_event)
        self.doc_changed = EventHook()

    def _options_changed_handler(self, analysis):
        if self._initialising_options == analysis.uuid:
            return
        
        print('SERVER OPTIONS CHANGED')
        analysis_xml = self.resources[analysis.uuid]["analysis_xml"]
        options_bytes = bytearray(analysis.options.as_bytes())
        hex = '0x' + binascii.hexlify(options_bytes).decode('ascii')
        if hex != analysis_xml.get_attribute('__options'):
            print('Out-going: OPTS Diff')
            if (self._txn != None):
                analysis_xml.set_attribute(self._txn, '__options', options_bytes)
            else:
                with self._doc.begin_transaction() as txn:
                    analysis_xml.set_attribute(txn, '__options', options_bytes)
        else:
            print('Out-going: OPTS SAME')

    def _results_changed_handler(self, analysis):
        print('RESULTS CHANGED')
        if analysis.has_results:
            resources = self.resources[analysis.uuid]
            results = analysis.results.results
            if results.status == ANALYSIS_COMPLETE:
                title = results.title
                group = results.group
                if (self._txn != None):
                    self.create_analysis_title(self._txn, title, resources)
                    self.findElements(self._txn, group, 'root', resources)
                else:
                    with self._doc.begin_transaction() as txn:
                        self.create_analysis_title(txn, title, resources)
                        self.findElements(txn, group, 'root', resources)

    def findElements(self, txn, group, base_path, analysis_resources):
        for element in group.elements:
            if element.HasField('table') or element.HasField('image'):
                path = base_path + ':' + element.name
                if path not in analysis_resources['result_items']:
                    self.create_result_item(txn, path, element, analysis_resources)
                else:
                    xlm_element = analysis_resources['result_items'][path]
                    result_bytes = bytearray(element.SerializeToString())
                    hex = '0x' + binascii.hexlify(result_bytes).decode('ascii')
                    if hex != xlm_element.get_attribute('__data'):
                        print('updating item - ' + path)
                        xlm_element.set_attribute(txn, '__data', result_bytes)
            elif element.HasField('group'):
                 self.findElements(txn, element.group, base_path + '.' + element.name, analysis_resources)
            elif element.HasField('array'):
                 self.findElements(txn, element.group, base_path + '.' + element.name, analysis_resources)

    def create_empty_paragraph(self, txn, analysis_resource):
        content_root = analysis_resource['analysis_content_xml']
        empty_paragraph = content_root.push_xml_text(txn)
        empty_paragraph.set_attribute(txn, '__type', 'paragraph')
        empty_paragraph.set_attribute(txn, '__format', 0)
        empty_paragraph.set_attribute(txn, '__style', '')
        empty_paragraph.set_attribute(txn, '__indent', 0)
        empty_paragraph.set_attribute(txn, '__dir', 'ltr')
        empty_paragraph.set_attribute(txn, '__textFormat', 0)
        empty_paragraph.set_attribute(txn, '__textStyle', '')

    def create_result_item(self, txn, path, element, analysis_resource):
        content_root = analysis_resource['analysis_content_xml']
        print('making item - ' + path)
        xlm_element = content_root.push_xml_element(txn, path)
        xlm_element.set_attribute(txn, '__type', 'result')
        xlm_element.set_attribute(txn, '__data', bytearray(element.SerializeToString()))
        analysis_resource['result_items'][path] = xlm_element

        self.create_empty_paragraph(txn, analysis_resource)

    def create_analysis_title(self, txn, title, analysis_resources):
        path = '__analysis_title'
        if path not in analysis_resources['result_items']:
            heading = analysis_resources['analysis_content_xml'].push_xml_text(txn)
            heading.set_attribute(txn, '__type', 'heading')
            heading.set_attribute(txn, '__format', 0)
            heading.set_attribute(txn, '__style', '')
            heading.set_attribute(txn, '__indent', 0)
            heading.set_attribute(txn, '__dir', 'ltr')
            heading.set_attribute(txn, '__textFormat', 0)
            heading.set_attribute(txn, '__textStyle', '')
            heading.set_attribute(txn, '__tag', 'h1')
            heading.push_attributes(txn, {
                '__type': 'text',
                '__format': 0,
                '__style': '',
                '__mode': 0,
                '__detail': 0,
            })
            heading.push(txn, title)
            analysis_resources['result_items'][path] = heading
        # else:
        #    heading.push(txn, title)

    def get_changes(self, state_vector: bytes | None = None) -> tuple[bytes, bytes]:
        """return the state of the document"""
        vector = Y.encode_state_vector(self._doc)
        update = Y.encode_state_as_update(self._doc, state_vector)
        return (vector, update)
    
    def on_event(self, event: Y.AfterTransactionEvent) -> None:
        if self._externalChanges == False and event.before_state != event.after_state:
            print(event.before_state)
            print(event.after_state)
            doc_changed_event = Event(self, 'doc_changed', event)
            self.doc_changed(doc_changed_event)

    def ydoc_analysis_changed(self, event):
        if '__options' in event.keys:
            optionDets = event.keys['__options']
            if optionDets['action'] == 'update':
                if (optionDets['newValue'] != optionDets['oldValue']):
                    print('YDOC ANALYSIS OPTIONS CHANGED')
                    ydoc_options_pb = AnalysisOptions()
                    ydoc_options_pb.ParseFromString(optionDets['newValue'])
                    asyncio.create_task(sync_ydoc_to_options(self.resources, event.target, ydoc_options_pb))

    def create_new_analyses(self, root):
        """populate any new analyses with tables and plots"""
        child = root.first_child
        while child is not None:
            if type(child).__name__ == 'YXmlElement':
                uuid = child.get_attribute('__uuid')
                if uuid is not None:
                    if uuid not in self.resources:
                        analysis_content_xml = self._doc.get_xml_fragment(uuid)
                        analysis_content_text_xml = self._doc.get_xml_text(uuid)
                        with self._doc.begin_transaction() as txn:
                            self._txn = txn

                            name = child.get_attribute('__name')
                            ns = child.get_attribute('__ns')

                            bytes = binascii.unhexlify(child.get_attribute('__options')[2:])
                            ydoc_options_pb = AnalysisOptions()
                            ydoc_options_pb.ParseFromString(bytes)
                            
                            self._initialising_options = uuid
                            analysis = self._analyses.create(0, name, ns, ydoc_options_pb)
                            
                            analysis.uuid = uuid
                            observer_id = child.observe(self.ydoc_analysis_changed)

                            resource = { "result_items": {}, "observer_id": observer_id, "analysis": analysis, "analysis_content_xml": analysis_content_xml, "analysis_xml": child, "revision": 0 }
                            self.resources[uuid] = resource
                            
                            analysis.run()
                            self._initialising_options = None
                            analysis_content_text_xml.set_attribute(txn, '__dir', 'ltr')
                        self._txn = None
                    else:
                        analysis_content_xml = self._doc.get_xml_fragment(uuid)
                        self.create_new_analyses(analysis_content_xml)
            child = child.next_sibling

    def apply_changes(self, changes: bytes):
        """apply changes to the document"""
        self._externalChanges = True
        Y.apply_update(self._doc, changes)
        self._externalChanges = False
        root = self._doc.get_xml_fragment('root')
        self.create_new_analyses(root)
        print('YDoc Update applied to server.')
        
