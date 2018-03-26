
import zipfile
from zipfile import ZipFile
import io
import json
from tempfile import NamedTemporaryFile
from tempfile import TemporaryDirectory
import struct
import os
import os.path
import re

from jamovi.core import ColumnType
from jamovi.core import MeasureType
from jamovi.server.appinfo import app_info


def write(data, path, html=None):

    with ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as zip:

        content = io.StringIO()
        content.write('Manifest-Version: 1.0\n')
        content.write('Data-Archive-Version: 1.0.2\n')
        content.write('jamovi-Archive-Version: 2.0\n')
        content.write('Created-By: ' + str(app_info) + '\n')
        zip.writestr('META-INF/MANIFEST.MF', bytes(content.getvalue(), 'utf-8'), zipfile.ZIP_DEFLATED)

        if html is not None:
            zip.writestr('index.html', html)

        content = None

        fields = [ ]
        for column in data:
            if column.is_virtual == True:
                continue

            field = { }
            field['name'] = column.name
            field['columnType'] = ColumnType.stringify(column.column_type)
            field['measureType'] = MeasureType.stringify(column.measure_type)
            field['formula'] = column.formula
            field['formulaMessage'] = column.formula_message
            if column.measure_type == MeasureType.CONTINUOUS:
                field['type'] = 'number'
            else:
                field['type'] = 'integer'
            field['importName'] = column.import_name
            field['description'] = column.description
            field['hidden'] = column.hidden
            field['active'] = column.active
            field['childOf'] = column.child_of
            fields.append(field)

        metadata = { }

        metadataset = { }
        metadataset['rowCount'] = data.row_count
        metadataset['columnCount'] = data.column_count
        metadataset['fields'] = fields

        if data.import_path is not '':
            metadataset['importPath'] = data.import_path
        if data.embedded_path is not '':
            metadataset['embeddedPath'] = data.embedded_path
        if data.embedded_name is not '':
            metadataset['embeddedName'] = data.embedded_name

        metadata['dataSet'] = metadataset

        zip.writestr('metadata.json', json.dumps(metadata), zipfile.ZIP_DEFLATED)

        metadata = None

        xdata = { }
        for column in data:
            if column.is_virtual == True:
                continue
            if column.has_levels:
                xdata[column.name] = { 'labels': column.levels }
        zip.writestr('xdata.json', json.dumps(xdata), zipfile.ZIP_DEFLATED)
        xdata = None

        row_count = data.row_count
        required_bytes = 0
        for column in data:
            if column.is_virtual == True:
                continue
            if column.measure_type == MeasureType.CONTINUOUS:
                required_bytes += (8 * row_count)
            else:
                required_bytes += (4 * row_count)

        temp_file = NamedTemporaryFile(delete=False)
        temp_file.truncate(required_bytes)

        for column in data:
            if column.is_virtual == True:
                continue
            if column.measure_type == MeasureType.CONTINUOUS:
                for i in range(0, row_count):
                    value = column.raw(i)
                    byts = struct.pack('<d', value)
                    temp_file.write(byts)
            else:
                for i in range(0, row_count):
                    value = column.raw(i)
                    byts = struct.pack('<i', value)
                    temp_file.write(byts)

        temp_file.close()

        zip.write(temp_file.name, 'data.bin')
        os.remove(temp_file.name)

        resources = [ ]

        for analysis in data.analyses:
            if analysis.has_results is False:
                continue
            analysis_dir = '{:02} {}/analysis'.format(analysis.id, analysis.name)
            zip.writestr(analysis_dir, analysis.serialize(), zipfile.ZIP_DEFLATED)
            resources += analysis.resources

        for rel_path in resources:
            abs_path = os.path.join(data.instance_path, rel_path)
            zip.write(abs_path, rel_path)

        if data.embedded_path is not '':
            try:
                path = os.path.join(data.instance_path, data.embedded_path)
                zip.write(path, data.embedded_path)
            except Exception as e:
                pass


def read(data, path):

    data.title = os.path.splitext(os.path.basename(path))[0]

    with ZipFile(path, 'r') as zip:
        manifest = zip.read('META-INF/MANIFEST.MF').decode('utf-8')

        regex = r'^jamovi-Archive-Version: ?([0-9]+)\.([0-9]+) ?$'
        jav   = re.search(regex, manifest, re.MULTILINE)

        if not jav:
            raise Exception('File is corrupt (no JAV)')

        jav = (int(jav.group(1)), int(jav.group(2)))
        if jav[0] > 2:
            raise Exception('A newer version of jamovi is required')

        meta_content = zip.read('metadata.json').decode('utf-8')
        metadata = json.loads(meta_content)
        meta_dataset = metadata['dataSet']

        if 'importPath' in meta_dataset:
            try:
                import_path = meta_dataset.get('importPath')
                if os.path.isfile(import_path):
                    data.import_path = import_path
            except Exception as e:
                pass

        if 'embeddedPath' in meta_dataset:
            try:
                embedded_path = meta_dataset.get('embeddedPath')
                embedded_name = meta_dataset.get('embeddedName', embedded_path)
                zip.extract(embedded_path, data.instance_path)
                data.embedded_path = embedded_path
                data.embedded_name = embedded_name
            except Exception as e:
                pass

        for meta_column in meta_dataset['fields']:
            name = meta_column['name']
            import_name = meta_column.get('importName', name)
            data.append_column(name, import_name)
            column = data[data.column_count - 1]

            column_type = ColumnType.parse(meta_column.get('columnType', 'Data'))
            column.column_type = column_type
            measure_type = MeasureType.parse(meta_column.get('measureType', 'Nominal'))
            column.measure_type = measure_type
            column.formula = meta_column.get('formula', '')
            column.formula_message = meta_column.get('formulaMessage', '')
            column.description = meta_column.get('description', '')
            column.hidden = meta_column.get('hidden', False)
            column.active = meta_column.get('active', True)
            column.child_of = meta_column.get('childOf', -1)


        row_count = meta_dataset['rowCount']

        data.set_row_count(row_count)

        columns_w_bad_levels = [ ]  # do some repair work

        try:
            xdata_content = zip.read('xdata.json').decode('utf-8')
            xdata = json.loads(xdata_content)

            for column in data:
                if column.name in xdata:
                    try:
                        meta_labels = xdata[column.name]['labels']
                        if meta_labels:
                            for meta_label in meta_labels:
                                import_value = meta_label[1]
                                if len(meta_label) > 2:
                                    import_value = meta_label[2]
                                column.append_level(meta_label[0], meta_label[1],  import_value)
                        else:
                            columns_w_bad_levels.append(column.id)
                    except Exception as e:
                        columns_w_bad_levels.append(column.id)
        except Exception:
            columns_w_bad_levels = filter(lambda col: col.measure_type is not MeasureType.CONTINUOUS, data.dataset)
            columns_w_bad_levels = map(lambda col: col.id, columns_w_bad_levels)
        with TemporaryDirectory() as dir:
            zip.extract('data.bin', dir)
            data_path = os.path.join(dir, 'data.bin')
            data_file = open(data_path, 'rb')

            BUFF_SIZE = 65536
            buff = memoryview(bytearray(BUFF_SIZE))

            for column in data.dataset:

                if column.measure_type == MeasureType.CONTINUOUS:
                    elem_fmt = '<d'
                    elem_width = 8
                    repair_levels = False
                else:
                    elem_fmt = '<i'
                    elem_width = 4
                    repair_levels = column.id in columns_w_bad_levels

                for row_offset in range(0, row_count, int(BUFF_SIZE / elem_width)):
                    n_bytes_to_read = min(elem_width * (row_count - row_offset), BUFF_SIZE)
                    buff_view = buff[0:n_bytes_to_read]
                    data_file.readinto(buff_view)

                    # 'if' surrounding two loops, rather than an 'if' inside one loop
                    # gives a performance improvement
                    if repair_levels:
                        i = 0
                        for values in struct.iter_unpack(elem_fmt, buff_view):
                            v = values[0]
                            if v != -2147483648:  # missing value
                                column.append_level(v, str(v))
                            column[row_offset + i] = v
                            i += 1
                    else:
                        i = 0
                        for values in struct.iter_unpack(elem_fmt, buff_view):
                            column[row_offset + i] = values[0]
                            i += 1

            data_file.close()

        for column in data:
            column.determine_dps()

        is_analysis = re.compile('^[0-9][0-9]+ .+/analysis$')
        is_resource = re.compile('^[0-9][0-9]+ .+/resources/.+')

        for entry in zip.infolist():
            if is_analysis.match(entry.filename):
                zip.extract(entry, data.instance_path)
                serial = zip.read(entry.filename)
                data.analyses.create_from_serial(serial)
            elif is_resource.match(entry.filename):
                zip.extract(entry, data.instance_path)
