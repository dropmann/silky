
import y_py as Y
import json
import asyncio
from jamovi.server.utils.event import EventHook, Event

def from_ydoc_to_lexical(doc: Y.YDoc, root_name='root') -> dict:
    d = {root_name: None}
    yroot = doc.get_xml_fragment(root_name)
    root = yroot.to_dict()
    q: list = [root]
    while q:
        obj = q.pop()
        if isinstance(obj, dict):
            keys = list(obj.keys())
            for key in keys:
                val = obj.pop(key)
                if isinstance(val, float) and val.is_integer():
                    val = int(val)
                if isinstance(val, bytearray):
                    val = repr(val)
                q.append(val)
                #obj[_decode_yxml_key(key)] = val
                obj[key] = val
            if obj.get('__type', '') == 'analysis':
                uuid = obj['__uuid']
                d.update(from_ydoc_to_lexical(doc, uuid))
        if isinstance(obj, list):
            q += obj
    d[root_name] = root
    return d

class AnalysesDoc:
    '''Analyses document'''

    _doc: Y.YDoc
    analyses = {}
    doc_changed: EventHook
    _externalChanges = False

    def __init__(self):
        self._doc = Y.YDoc()
        self._doc.observe_after_transaction(self.on_event)
        self.doc_changed = EventHook()

    def get_changes(self, state_vector: bytes | None = None) -> tuple[bytes, bytes]:
        """return the state of the document"""
        vector = Y.encode_state_vector(self._doc)
        update = Y.encode_state_as_update(self._doc, state_vector)
        return (vector, update)
    
    def on_event(self, event: Y.AfterTransactionEvent) -> None:
        if self._externalChanges == False:
            doc_changed_event = Event(self, 'doc_changed', event)
            self.doc_changed(doc_changed_event)

    def apply_changes(self, changes: bytes):
        """apply changes to the document"""
        self._externalChanges = True
        print('damo1')
        Y.apply_update(self._doc, changes)
        print('damo2')
        self._externalChanges = False
        root = self._doc.get_xml_fragment('root')

        print(json.dumps(from_ydoc_to_lexical(self._doc), indent=2))

        child = root.first_child

        while child is not None:
            print(type(child).__name__)
            if type(child).__name__ == 'YXmlElement':
                uuid = child.get_attribute('__uuid')
                print(uuid)
                if uuid is not None:
                    analysis = self._doc.get_xml_fragment(uuid)
                    if uuid not in self.analyses:
                        self.analyses[uuid] = analysis

                        ana_root = self._doc.get_xml_text(uuid)
                        with self._doc.begin_transaction() as txn:

                            ana_root.set_attribute(txn, '__dir', 'ltr')
                            print('making!')
                            heading = ana_root.push_xml_text(txn)
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
                            heading.push(txn, 'ANOVA')

                            empty_paragraph = ana_root.push_xml_text(txn)
                            empty_paragraph.set_attribute(txn, '__type', 'paragraph')
                            empty_paragraph.set_attribute(txn, '__format', 0)
                            empty_paragraph.set_attribute(txn, '__style', '')
                            empty_paragraph.set_attribute(txn, '__indent', 0)
                            empty_paragraph.set_attribute(txn, '__dir', 'ltr')
                            empty_paragraph.set_attribute(txn, '__textFormat', 0)
                            empty_paragraph.set_attribute(txn, '__textStyle', '')

                            table = ana_root.push_xml_element(txn, 'tony')
                            # this is strongly typed as 'table' and it will create a table node,
                            # can also use __type as 'result' and it will figure it out. (but at the moment can only figure out table)
                            # it won't be a tablenode but it will render a table all the same.
                            # I made the flexibility because one might be easier now and the other might be necessary later.
                            # although it might cause backwards compatibility issues. I prefer the strong typing because i feel like it is safer
                            # in regards to lexical and interactions re type like menus or resizing.

                            table_bytes = bytearray.fromhex('0a046d61696e120b414e4f5641202d206c656e28013281050a3c0a046e616d651a04746578743a081a04646f736528013a061a04737570703a0d1a09646f73653a7375707028023a0d1a09526573696475616c7328030a480a027373120e53756d206f6620537175617265731a066e756d6265723a09117a4cf060def4a2403a09113c33333333ab69403a091130dbf97e6a145b403a0911032b8716d94086400a3d0a026466120264661a07696e74656765723a091100000000000000403a0911000000000000f03f3a091100000000000000403a09110000000000004b400a450a026d73120b4d65616e205371756172651a066e756d6265723a09117a4cf060def492403a09113c33333333ab69403a091130dbf97e6a144b403a0911469bcfe1d15f2a400a330a01461201461a066e756d6265723a0911cd00c06cffff56403a09115eeba47dda242f403a0911f828c7128f6d10403a021a000a3f0a01701201701a066e756d626572220a7a746f2c7076616c75653a0911aa06a27904a9523c3a0911c3c1f936354d2e3f3a0911c56424d18962963f3a021a000a410a0565746153711204ceb7c2b21a066e756d62657222037a746f3a0911036a450ddd7de63f3a0911897ea7f9a374ae3f3a09112c887ef69b10a03f3a021a0078010a430a066574615371501205ceb7c2b2701a066e756d62657222037a746f3a09113a94cd744fbde83f3a0911fc1512f14fa6cc3f3a0911f0c6e0664ae6c03f3a021a0078010a430a076f6d65676153711204cf89c2b21a066e756d62657222037a746f3a091107778df49a29e63f3a09117b1a0f533164ac3f3a0911fec3f1bccd36983f3a021a007801120622646f7365221206227375707022120f5b22646f7365222c2273757070225d1202222238ffffffffffffffffff01820103636172')

                            table.set_attribute(txn, '__type', 'result')
                            table.set_attribute(txn, '__data', table_bytes)

                            empty_paragraph = ana_root.push_xml_text(txn)
                            empty_paragraph.set_attribute(txn, '__type', 'paragraph')
                            empty_paragraph.set_attribute(txn, '__format', 0)
                            empty_paragraph.set_attribute(txn, '__style', '')
                            empty_paragraph.set_attribute(txn, '__indent', 0)
                            empty_paragraph.set_attribute(txn, '__dir', 'ltr')
                            empty_paragraph.set_attribute(txn, '__textFormat', 0)
                            empty_paragraph.set_attribute(txn, '__textStyle', '')

                            table = ana_root.push_xml_element(txn, 'table')
                            table.set_attribute(txn, '__type', 'result')
                            table.set_attribute(txn, '__data', table_bytes)

                            empty_paragraph = ana_root.push_xml_text(txn)
                            empty_paragraph.set_attribute(txn, '__type', 'paragraph')
                            empty_paragraph.set_attribute(txn, '__format', 0)
                            empty_paragraph.set_attribute(txn, '__style', '')
                            empty_paragraph.set_attribute(txn, '__indent', 0)
                            empty_paragraph.set_attribute(txn, '__dir', 'ltr')
                            empty_paragraph.set_attribute(txn, '__textFormat', 0)
                            empty_paragraph.set_attribute(txn, '__textStyle', '')

            child = child.next_sibling
