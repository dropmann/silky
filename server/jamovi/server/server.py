
import tornado.ioloop
import tornado.netutil
import tornado.httpserver

from tornado.web import RequestHandler
from tornado.web import StaticFileHandler
from tornado.web import stream_request_body
from tornado.concurrent import Future
from tornado import gen

from .clientconnection import ClientConnection
from .session import Session
from .modules import Modules
from .utils import conf
from jamovi.core import Dirs

import sys
import os
import os.path
import uuid
import mimetypes
import re
import json

import tempfile
import logging
import pkg_resources
import threading
import asyncio

log = logging.getLogger('jamovi')

tornado_major = int(tornado.version.split('.')[0])
if tornado_major < 5:
    raise RuntimeError('tornado 5+ is required')


class SingleFileHandler(RequestHandler):

    def initialize(self, path, is_pkg_resource=False, mime_type=None, no_cache=False):
        self._path = path
        self._is_pkg_resource = is_pkg_resource
        self._mime_type = mime_type
        self._no_cache = no_cache

    def get(self):
        if self._mime_type is not None:
            self.set_header('Content-Type', self._mime_type)
        if self._is_pkg_resource:
            with pkg_resources.resource_stream(__name__, self._path) as file:
                content = file.read()
                self.write(content)
        else:
            with open(self._path, 'rb') as file:
                content = file.read()
                self.write(content)

    def set_extra_headers(self, path):
        if self._no_cache:
            self.set_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')


class ResourceHandler(RequestHandler):

    def initialize(self, session):
        self._session = session

    def get(self, instance_id, resource_id):
        instance = self._session.get(instance_id)
        if instance is None:
            self.set_status(404)
            self.write('<h1>404</h1>')
            self.write('instance ' + instance_id + ' could not be found')
            return

        resource_path = instance.get_path_to_resource(resource_id)

        mt = mimetypes.guess_type(resource_id)

        with open(resource_path, 'rb') as file:
            if mt[0] is not None:
                self.set_header('Content-Type', mt[0])
            if mt[1] is not None:
                self.set_header('Content-Encoding', mt[1])
            content = file.read()
            self.write(content)


class ModuleAssetHandler(RequestHandler):

    def get(self, instance_id, analysis_id, path):
        instance = self._session.get(instance_id)
        if instance is None:
            self.set_status(404)
            self.write('<h1>404</h1>')
            self.write('instance ' + instance_id + ' could not be found')
            return

        analysis = instance.analyses.get(int(analysis_id))
        module_name = analysis.ns
        module_path = Modules.instance().get(module_name).path
        asset_path = os.path.join(module_path, 'R', analysis.ns, path)

        if asset_path.startswith(module_path) is False:
            self.set_status(403)
            self.write('<h1>403</h1>')
            self.write('verboten')
            return

        mt = mimetypes.guess_type(asset_path)

        with open(asset_path, 'rb') as file:
            content = file.read()
            if mt[0] is not None:
                self.set_header('Content-Type', mt[0])
            if mt[1] is not None:
                self.set_header('Content-Encoding', mt[1])
            self.write(content)


class UploadHandler(RequestHandler):
    def post(self):
        file_info = self.request.files['file'][0]
        file_name = file_info['filename']
        ext       = os.path.splitext(file_name)[1]
        content   = file_info['body']
        temp_name = str(uuid.uuid4()) + ext
        temp_file = os.path.join('/tmp', temp_name)
        with open(temp_file, 'wb') as file:
            file.write(content)


class AnalysisDescriptor(RequestHandler):

    def get(self, module_name, analysis_name, part):
        if part == '':
            part = 'js'

        module_path = Modules.instance().get(module_name).path

        if part == 'js':
            analysis_path = os.path.join(module_path, 'ui', analysis_name.lower() + '.' + part)
        else:
            analysis_path = os.path.join(module_path, 'analyses', analysis_name.lower() + '.' + part)
        analysis_path = os.path.realpath(analysis_path)

        try:
            with open(analysis_path, 'rb') as file:
                content = file.read()
                self.set_header('Content-Type', 'text/plain')
                self.write(content)
        except Exception as e:
            log.info(e)
            self.set_status(404)
            self.write('<h1>404</h1>')
            self.write(str(e))


class LoginHandler(RequestHandler):
    def post(self):
        # username = self.get_argument('username', None)
        # password = self.get_argument('password', None)
        self.set_cookie('authId', str(uuid.uuid4()))
        self.set_status(204)


class SFHandler(StaticFileHandler):
    def initialize(self, **kwargs):
        if 'no_cache' in kwargs:
            self._no_cache = kwargs['no_cache']
            del kwargs['no_cache']
        else:
            self._no_cache = False
        StaticFileHandler.initialize(self, **kwargs)

    def set_extra_headers(self, path):
        if self._no_cache:
            self.set_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')


@stream_request_body
class PDFConverter(RequestHandler):

    def initialize(self, pdfservice):
        self._pdfservice = pdfservice
        self._file = None

    def prepare(self):
        self._file = tempfile.NamedTemporaryFile(suffix='.html')

    def data_received(self, data):
        self._file.write(data)

    @gen.coroutine
    def post(self):
        self._file.flush()
        try:
            pdf_path = yield self._pdfify()
            with open(pdf_path, 'rb') as file:
                content = file.read()
                self.set_header('Content-Type', 'application/pdf')
                self.write(content)
        except Exception as e:
            self.set_status(500)
            self.write(str(e))

    def _pdfify(self):
        self._future = Future()
        self._pdfservice._request({
            'cmd': 'convert-to-pdf',
            'args': [ self._file.name ],
            'waiting': self._future })
        return self._future


class DatasetsList(RequestHandler):

    def initialize(self, session):
        self._session = session

    def get(self):
        datasets = [ ]
        for id, instance in self._session.items():
            datasets.append({
                'id': id,
                'title': instance._data.title,
                'buffer': instance._buffer_path,
                'rowCount': instance._data.row_count,
                'columnCount': instance._data.column_count,
            })
        self.set_header('Content-Type', 'application/json')
        self.write(json.dumps(datasets))


class Server:

    ETRON_RESP_REGEX = re.compile(r'^response: ([a-z-]+) \(([0-9]+)\) ([10]) ?"(.*)"\n?$')
    ETRON_NOTF_REGEX = re.compile(r'^notification: ([a-z-]+) ?(.*)\n?$')

    def __init__(self, port, host='127.0.0.1', slave=False, stdin_slave=False, debug=False):

        self._session = None

        if port == 0:
            self._ports = [ 0, 0, 0 ]
        else:
            self._ports = [int(port), int(port) + 1, int(port) + 2]

        self._ioloop = asyncio.get_event_loop()

        self._host = host
        self._slave = slave and not stdin_slave
        self._stdin_slave = stdin_slave
        self._debug = debug
        self._ports_opened_listeners = [ ]

        conf.set('debug', debug)

        if stdin_slave:
            self._thread = threading.Thread(target=self._read_stdin)
            self._thread.start()

        self._etron_reqs = [ ]
        self._etron_req_id = 0

    def _set_update_status(self, status):
        self._request({
            'cmd': 'software-update',
            'args': [ status ] })

    def _request(self, request):
        request['id'] = str(self._etron_req_id)
        self._etron_req_id += 1
        self._etron_reqs.append(request)
        cmd = 'request: {} ({}) "{}"\n'.format(
            request['cmd'],
            request['id'],
            request['args'][0])
        sys.stdout.write(cmd)
        sys.stdout.flush()

    def add_ports_opened_listener(self, listener):
        self._ports_opened_listeners.append(listener)

    def _read_stdin(self):
        try:
            for line in sys.stdin:
                line = line.strip()
                asyncio.run_coroutine_threadsafe(self._process_stdin(line), self._ioloop)
        except OSError:
            pass
        self._ioloop.call_soon_threadsafe(self.stop)

    async def _process_stdin(self, line):

        match = Server.ETRON_RESP_REGEX.match(line)

        if match:
            id = match.group(2)
            for request in self._etron_reqs:
                if request['id'] == id:
                    if match.group(3) == '1':
                        request['waiting'].set_result(match.group(4))
                    else:
                        request['waiting'].set_exception(RuntimeError(match.group(4)))
                    self._etron_reqs.remove(request)
                    return

        match = Server.ETRON_NOTF_REGEX.match(line)

        if match:
            notification_type = match.group(1)
            notification_message = match.group(2)
            if notification_type == 'update':
                self._session.set_update_status(notification_message)
            return

        if line.startswith('install: '):
            path = line[9:]
            Modules.instance().install(path, lambda t, res: None)
            self._session.notify_global_changes()
            await self._session.restart_engines()
            self._session.rerun_analyses()
        else:
            sys.stderr.write(line)
            sys.stderr.flush()

    def _lonely_suicide(self):
        if len(self._session) == 0:
            self.stop()

    def stop(self):
        self._ioloop.stop()

    def start(self):

        client_path = conf.get('client_path')
        version_path = conf.get('version_path', False)
        if not version_path:
            version_path = os.path.join(conf.get('home'), 'Resources', 'jamovi', 'version')
        coms_path   = 'jamovi.proto'

        data_dir = tempfile.TemporaryDirectory()
        data_path = data_dir.name
        session_id = str(uuid.uuid4())
        session_path = os.path.join(data_path, session_id)
        os.makedirs(session_path)

        self._session = Session(data_path, session_id)
        self._session.set_update_request_handler(self._set_update_status)

        self._main_app = tornado.web.Application([
            (r'/version', SingleFileHandler, { 'path': version_path }),
            (r'/login', LoginHandler),
            (r'/coms', ClientConnection, { 'session': self._session }),
            (r'/upload', UploadHandler),
            (r'/proto/coms.proto', SingleFileHandler, {
                'path': coms_path,
                'is_pkg_resource': True,
                'mime_type': 'text/plain',
                'no_cache': self._debug }),
            (r'/analyses/(.*)/(.*)/(.*)', AnalysisDescriptor),
            (r'/analyses/(.*)/(.*)()', AnalysisDescriptor),
            (r'/utils/to-pdf', PDFConverter, { 'pdfservice': self }),
            (r'/api/datasets', DatasetsList, { 'session': self._session }),
            (r'/(.*)', SFHandler, {
                'path': client_path,
                'default_filename': 'index.html',
                'no_cache': self._debug })
        ])

        analysisui_path = os.path.join(client_path,    'analysisui.html')
        analysisuijs_path  = os.path.join(client_path, 'analysisui.js')
        analysisuicss_path = os.path.join(client_path, 'analysisui.css')
        assets_path = os.path.join(client_path, 'assets')

        self._analysisui_app = tornado.web.Application([
            (r'/.*/', SingleFileHandler, {
                'path': analysisui_path,
                'no_cache': True }),
            (r'/.*/analysisui.js',  SingleFileHandler, {
                'path': analysisuijs_path,
                'mime_type': 'text/javascript',
                'no_cache': self._debug }),
            (r'/.*/analysisui.css', SingleFileHandler, {
                'path': analysisuicss_path,
                'mime_type': 'text/css',
                'no_cache': self._debug }),
            (r'/.*/assets/(.*)', SFHandler, {
                'path': assets_path,
                'no_cache': self._debug }),
        ])

        resultsview_path    = os.path.join(client_path, 'resultsview.html')
        resultsviewjs_path  = os.path.join(client_path, 'resultsview.js')
        resultsviewcss_path = os.path.join(client_path, 'resultsview.css')

        self._resultsview_app = tornado.web.Application([
            (r'/.*/.*/', SingleFileHandler, { 'path': resultsview_path }),
            (r'/.*/.*/resultsview.js',  SingleFileHandler, { 'path': resultsviewjs_path, 'mime_type': 'text/javascript' }),
            (r'/.*/.*/resultsview.css', SingleFileHandler, { 'path': resultsviewcss_path, 'mime_type': 'text/css' }),
            (r'/.*/.*/assets/(.*)', SFHandler, {
                'path': assets_path,
                'no_cache': self._debug }),
            (r'/(.*)/.*/res/(.*)', ResourceHandler, { 'session': self._session }),
            (r'/(.*)/(.*)/module/(.*)', ModuleAssetHandler),
        ])

        sockets = tornado.netutil.bind_sockets(self._ports[0], self._host)
        server = tornado.httpserver.HTTPServer(self._main_app)
        server.add_sockets(sockets)
        self._ports[0] = sockets[0].getsockname()[1]

        sockets = tornado.netutil.bind_sockets(self._ports[1], self._host)
        server = tornado.httpserver.HTTPServer(self._analysisui_app)
        server.add_sockets(sockets)
        self._ports[1] = sockets[0].getsockname()[1]

        sockets = tornado.netutil.bind_sockets(self._ports[2], self._host)
        server = tornado.httpserver.HTTPServer(self._resultsview_app)
        server.add_sockets(sockets)
        self._ports[2] = sockets[0].getsockname()[1]

        for listener in self._ports_opened_listeners:
            listener(self._ports)

        if self._slave:
            check = tornado.ioloop.PeriodicCallback(self._lonely_suicide, 1000)
            self._ioloop.call_later(3, check.start)

        # write the port no. to a file, so external software can
        # find out what port jamovi is running on
        app_data = Dirs.app_data_dir()
        port_name = str(self._ports[0]) + '.port'
        port_file = os.path.join(app_data, port_name)
        with open(port_file, 'w'):
            pass

        for entry in os.scandir(app_data):
            if entry.name == port_name:
                continue
            if entry.name.endswith('.port') and entry.is_file():
                os.remove(entry.path)

        try:
            self._ioloop.run_forever()
        except KeyboardInterrupt:
            pass

        try:
            os.remove(port_file)
        except Exception:
            pass
