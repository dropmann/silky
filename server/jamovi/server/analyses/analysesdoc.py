
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

async def set_heading(doc, xml_element, text):
    print('DAMO!!!!!!!!!!!!!!1')
    print('DAMO' + text)
    with doc.begin_transaction() as txn:
        xml_element.insert(txn, 0, text)

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
            results = analysis.results.results
            if results.status == ANALYSIS_COMPLETE:
                if (self._txn != None):
                    self.update_analysis(self._txn, analysis)
                else:
                    with self._doc.begin_transaction() as txn:
                        self.update_analysis(txn, analysis)


    def update_analysis(self, txn, analysis):

        resources = self.resources[analysis.uuid]
        # print(analysis.results.results)

        resources['result_items'] = self.initalise_items_for_update(resources)

        # update analysis id
        if analysis.id != resources['analysis_xml'].get_attribute('__id'):
            resources['analysis_xml'].set_attribute(txn, '__id', analysis.id)

        # send the AnalysisResponse as a quicka and cheap way to get references
        # because i was having trouble sending them another way
        dets_bytes = bytearray(analysis.results.SerializeToString())
        dets_hex = '0x' + binascii.hexlify(dets_bytes).decode('ascii')
        if dets_hex != resources['analysis_xml'].get_attribute('__dets'):
            resources['analysis_xml'].set_attribute(txn, '__dets', dets_bytes)

        title = analysis.results.results.title
        group = analysis.results.results.group

        # self.create_analysis_title(txn, title, 'h1', resources)
        title_path = 'root:heading'
        if title_path not in resources['result_items']:
            self.create_heading(txn, title_path, 0, title, 'h1', True, resources)
        else:
            resources['result_items'][title_path]['processed'] = True
        self.findElements(txn, group, 1, 0, 1, 'root', resources)

        self.post_analysis_update_cleanup(txn, resources)


    def post_analysis_update_cleanup(self, txn, analysis_resources):
        items = analysis_resources['result_items']
        
        index = 0
        begin_index = -1
        length = 0
        clip = False

        content_root = analysis_resources['analysis_content_xml']
        child = content_root.first_child
        while child is not None:
            item = self.get_result_item(items, child)
            if item != None:
                if item['index'] == -1:
                    item['index'] = index
                if item['processed'] == False:
                    print('DELETEING ' + item['path'])
                    del items[item['path']]
                    if begin_index == -1:
                        begin_index = index
                    length += 1
                elif begin_index != -1:
                    clip = True
            elif begin_index != -1:
                clip = True
                
            if clip:
                print('deleteing - ' + str(begin_index)+':'+str(length))
                content_root.delete(txn, begin_index, length)
                begin_index = -1
                length = 0
                clip = False

            child = child.next_sibling
            index += 1

        if begin_index != -1:
            print('deleteing - ' + str(begin_index)+':'+str(length))
            content_root.delete(txn, begin_index, length) 

    def get_result_item(self, items, xmlItem):
        item = None

        path = xmlItem.get_attribute('__path')
        if path in items:
            item = items[path]
        elif path != None:
            item = { 'xml_element': xmlItem, 'processed': False, 'index': -1, 'path': path }
            items[path] = item
        return item

    def findElements(self, txn, group, level, visible, current_index, base_path, analysis_resources):
        items = analysis_resources['result_items']
        has_visible_children = False
        group_vis = visible == 0 or visible == 2
        for element in group.elements:
            el_vis = element.visible == 0 or element.visible == 2
            if has_visible_children == False and el_vis == True:
                has_visible_children = True
            if group_vis == False and el_vis == True:
                element.visible = visible
            if element.HasField('table') or element.HasField('image'):
                path = base_path + ':' + element.name
                if path not in items:
                    print(path + ' inserted at ' + str(current_index) )
                    current_index = self.create_result_item(txn, current_index, path, element, analysis_resources)
                else:
                    item = items[path]
                    current_index = item['index']
                    xlm_element = item['xml_element']
                    result_bytes = bytearray(element.SerializeToString())
                    hex = '0x' + binascii.hexlify(result_bytes).decode('ascii')
                    if hex != xlm_element.get_attribute('__data'):
                        print('updating item - ' + path)
                        xlm_element.set_attribute(txn, '__data', result_bytes)
                items[path]['processed'] = True
                current_index += 1
            elif element.HasField('group'):
                group_path = base_path + ':' + element.name
                current_index = self.create_result_group(txn, group_path, element, element.group, current_index, level+1, analysis_resources)
            elif element.HasField('array'):
                group_path = base_path + ':' + element.name
                current_index = self.create_result_group(txn, group_path, element, element.array, current_index, level+1, analysis_resources)
        return { 'current_index': current_index, 'visible_children': has_visible_children }

    def create_result_group(self, txn, group_path, element, group, index, level, analysis_resources):
        current_index = index
        el_vis = element.visible == 0 or element.visible == 2
        heading_path = group_path + ':heading'
        visible = element.title != '' and el_vis
        items = analysis_resources['result_items']
        if heading_path not in items:
            current_index = self.create_heading(txn, heading_path, index, element.title, 'h' + str(level), visible, analysis_resources)
        else:
            item = items[heading_path]
            xml_element = item['xml_element']
            if xml_element.get_attribute('__visible') != visible:
                xml_element.set_attribute(txn, '__visible', visible)
            if xml_element.get_attribute('__defaultValue') != element.title:
                xml_element.set_attribute(txn, '__defaultValue', element.title)
            # print('tom' + xml_element.__str__() + 'tom')
            # print('LEN' + str(xml_element.__len__()) + 'LEN')
            # print('STP' + str(len(xml_element.__str__().strip())) + 'STP')
            # if xml_element.__len__() < 3: # xml_element.__str__().strip() == '':
                # xml_element.delete(txn, 0, xml_element.__len__())
                # default_value = xml_element.get_attribute('__defaultValue')
                # xml_element.push(txn, default_value)
        current_index += 1

        dets = self.findElements(txn, group, level, element.visible, current_index, group_path, analysis_resources)

        if dets['visible_children'] == False and visible == True:
            items[heading_path]['xml_element'].set_attribute(txn, '__visible', False)

        items[heading_path]['processed'] = True

        return dets['current_index']


    def create_empty_paragraph(self, txn, index, analysis_resource):
        content_root = analysis_resource['analysis_content_xml']
        empty_paragraph = content_root.insert_xml_text(txn, index)
        empty_paragraph.set_attribute(txn, '__type', 'paragraph')
        empty_paragraph.set_attribute(txn, '__format', 0)
        empty_paragraph.set_attribute(txn, '__style', '')
        empty_paragraph.set_attribute(txn, '__indent', 0)
        empty_paragraph.set_attribute(txn, '__dir', 'ltr')
        empty_paragraph.set_attribute(txn, '__textFormat', 0)
        empty_paragraph.set_attribute(txn, '__textStyle', '')
        return index

    def create_result_item(self, txn, index, path, element, analysis_resource):
        content_root = analysis_resource['analysis_content_xml']
        print('making item - ' + path)
        xlm_element = content_root.insert_xml_element(txn, index, path)
        xlm_element.set_attribute(txn, '__type', 'result')
        xlm_element.set_attribute(txn, '__path', path)
        xlm_element.set_attribute(txn, '__data', bytearray(element.SerializeToString()))
        analysis_resource['result_items'][path] = { 'xml_element': xlm_element, 'processed': True, 'index': index, 'path': path }

        return index # self.create_empty_paragraph(txn, index + 1, analysis_resource)
    
    def initalise_items_for_update(self, analysis_resources):
        items = { }

        content_root = analysis_resources['analysis_content_xml']
        child = content_root.first_child
        index = 0
        while child is not None:
            item = self.get_result_item(items, child)
            if item != None:
                item['index'] = index

            child = child.next_sibling
            index += 1
        
        return items

    def create_heading(self, txn, path, index, title, tag, visible, analysis_resources):
        print(path + ' ' + str(index))
        heading = analysis_resources['analysis_content_xml'].insert_xml_text(txn, index)
        heading.set_attribute(txn, '__type', 'result-heading')
        heading.set_attribute(txn, '__format', 0)
        heading.set_attribute(txn, '__style', '')
        heading.set_attribute(txn, '__indent', 0)
        heading.set_attribute(txn, '__dir', 'ltr')
        heading.set_attribute(txn, '__textFormat', 0)
        heading.set_attribute(txn, '__textStyle', '')
        heading.set_attribute(txn, '__tag', tag)
        heading.set_attribute(txn, '__path', path)
        heading.set_attribute(txn, '__visible', visible)
        heading.set_attribute(txn, '__defaultValue', title)
        heading.push_attributes(txn, {
            '__type': 'text',
            '__format': 0,
            '__style': '',
            '__mode': 0,
            '__detail': 0,
        })
        heading.push(txn, title)
        analysis_resources['result_items'][path] = { 'xml_element': heading, 'processed': True, 'index': index, 'path': path }
        
        return index



    def create_analysis_title(self, txn, title, tag, analysis_resources):
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
            heading.set_attribute(txn, '__tag', tag)
            heading.push_attributes(txn, {
                '__type': 'text',
                '__format': 0,
                '__style': '',
                '__mode': 0,
                '__detail': 0,
            })
            heading.push(txn, title)
            analysis_resources['result_items'][path] = { 'xml_element': heading, 'processed': True, 'index': 0, 'path': path }
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
        
