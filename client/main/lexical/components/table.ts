
import { determFormat, format } from '../../../common/formatting';
import { AnalysisElement } from './element';
import focusLoop from '../../../common/focusloop';
import { mergeRegister } from '@lexical/utils';

const SUPSCRIPTS = ["\u1D43", "\u1D47", "\u1D48", "\u1D49", "\u1DA0", "\u1D4D", "\u02B0", "\u2071",
    "\u02B2", "\u1D4F", "\u02E1", "\u1D50", "\u207F", "\u1D52", "\u1D56", "\u02B3", "\u02E2",
    "\u1D57", "\u1D58", "\u1D5B", "\u02B7", "\u02E3", "\u02B8", "\u1DBB"];

const Format = {
    BEGIN_GROUP: 1,
    END_GROUP: 2,
    NEGATIVE: 4,
    INDENTED: 8,
};

const extractCellValue = function (cellPB) {
    if (cellPB.cellType === 'o')
        return null;
    else
        return cellPB[cellPB.cellType];
};

const createSortTransform = function (column, dir): Array<number> {

    let trans = new Array(column.cells.length);

    let sortBy;
    if (column.hasSortKeys)
        sortBy = (a, b) => a.sortKey - b.sortKey;
    else
        sortBy = (a, b) => extractCellValue(a) - extractCellValue(b);

    let i = 0;
    let cells = column.cells.slice().sort(sortBy);
    for (let cell of cells) {
        let index = column.cells.indexOf(cell);
        trans[i++] = index;
    }

    if (dir === 'desc')
        trans = trans.reverse();

    return trans;
};

const isVis = function (column): boolean {
    return column.visible === 0 || column.visible === 2;
};

export class Table extends AnalysisElement {
    __sortTransform: Array<number>;
    __sortedCells: any;
    __table: HTMLElement;
    __titleCell: HTMLElement;
    __tableHeader: HTMLElement;
    __titleText: HTMLElement;
    __status: HTMLElement;
    __columnHeaderRow: HTMLElement;
    __tableBody: HTMLElement;
    __tableFooter: HTMLElement;
    __columnHeaderRowSuper: HTMLElement | null;

    constructor(data: any, nodeKey: string) {
        super(data, nodeKey);

        this.__columnHeaderRowSuper = null;
        this.__sortTransform = [];

        let table = this.__data.table;
        let cells = table.columns.map(column => column.cells);

        if (table.sortSelected) {

            let sortBy = table.sortSelected.sortBy;
            let sortDesc = table.sortSelected.sortDesc;

            this.sort(sortBy, sortDesc ? 'desc' : 'asc');

        } else {

            if (cells.length > 0 && cells[0].length > 0) {
                let trans = new Array(cells[0].length);
                for (let i = 0; i < trans.length; i++)
                    trans[i] = i;
                this.__sortTransform = trans;
            }

            this.__sortedCells = cells;
        }

        this.classList.add('jmv-results-table');

        //this._ascButtons = $();
        //this._descButtons = $();
        //this._trs = $();

        let rowSelectable = table.rowSelect ? ' row-selectable' : '';

        let titleId = focusLoop.getNextFocusId('label');
        let tableElement = document.createElement('table');
        tableElement.inert = true;
        tableElement.setAttribute('aria-labelledby', titleId);
        tableElement.classList.add(`jmv-results-table-table${rowSelectable}`);
        this.appendChild(tableElement);
        this.__table = tableElement;

        let titleCellElement = document.createElement('caption');
        titleCellElement.setAttribute('scope', 'col');
        titleCellElement.setAttribute('colspan', '1');
        titleCellElement.classList.add(`jmv-results-table-title-cell`);
        this.__table.appendChild(titleCellElement);
        this.__titleCell = titleCellElement;

        let tableHeaderElement = document.createElement('thead');
        this.__table.appendChild(tableHeaderElement);
        this.__tableHeader = tableHeaderElement;

        let titleTextElement = document.createElement('span');
        titleTextElement.setAttribute('id', titleId);
        titleTextElement.classList.add(`jmv-results-table-title-text`);
        this.__titleCell.appendChild(titleTextElement);
        this.__titleText = titleTextElement;


        let statusElement = document.createElement('div');
        statusElement.classList.add(`jmv-results-table-status-indicator`);
        this.__titleCell.appendChild(statusElement);
        this.__status = statusElement;

        let columnHeaderRowElement = document.createElement('tr');
        columnHeaderRowElement.classList.add(`jmv-results-table-header-row-main`);
        this.__tableHeader.appendChild(columnHeaderRowElement);
        this.__columnHeaderRow = columnHeaderRowElement;

        let tableBodyElement = document.createElement('tbody');
        this.__table.appendChild(tableBodyElement);
        this.__tableBody = tableBodyElement;

        let tableFooterElement = document.createElement('tfoot');
        this.__table.appendChild(tableFooterElement);
        this.__tableFooter = tableFooterElement;

        //this.model.on('change:sortedCells', () => this.render());

        //this.setFocusElement(this.$table[0]);
        
    }

    public get type() {
        return 'table';
    }

    protected registerEvents() {
        return mergeRegister(
            super.registerEvents(),
            this._context.refTable.addEventListener('changed', this.render),
        );
    }

    _css() {
        return `   
    .jmv-results-table-status-indicator {
          visibility: hidden ;
          display: inline-block ;
          width: 12px ;
          height: 12px ;
          margin-left: 6px ;
          margin-bottom: 2px ;
          background-size: 100% ;
          position: relative ;
          top: 2px ;
      }
  
      .jmv-results-status-inited  .jmv-results-table-status-indicator,
      .jmv-results-status-running .jmv-results-table-status-indicator {
          visibility: visible ;
          background-image: url('../assets/indicator-running.svg');
      }
  
      .jmv-results-table-table {
          border-collapse: collapse ;
          border-color: black ;
          width: 1px ;
      }
  
      .jmv-results-table-title-cell {
          text-align: left ;
          font-weight: normal ;
          min-width: 4em ;
          padding: 4px 8px 4px 0;
          white-space: nowrap ;
          caption-side: top;
      }
  
      td.jmv-results-table-cell,
      th[scope=row].jmv-results-table-cell,
      th[scope=rowgroup].jmv-results-table-cell {
          padding: 2px 8px ;
          white-space: nowrap ;
          vertical-align: top;
      }
  
      td.jmv-results-table-cell.jmv-results-table-cell-indented,
      th[scope=row].jmv-results-table-cell.jmv-results-table-cell-indented,
      th[scope=rowgroup].jmv-results-table-cell.jmv-results-table-cell-indented {
          padding-left: 24px ;
      }
  
      .jmv-results-table-table tfoot td {
          padding: 2px 8px ;
      }
  
      .jmv-results-table-table tfoot tr:first-child td {
          padding-top: 6px ;
      }
  
      th[scope=row],
      th[scope=rowgroup],
      td.jmv-results-table-cell-text,
      td.jmv-results-table-cell-integer,
      td.jmv-results-table-cell-number,
      td.jmv-results-table-cell-missing {
          position: relative ;
      }
  
      td.jmv-results-table-cell-integer,
      td.jmv-results-table-cell-number {
          padding-right: 20px ;
      }
  
      .jmv-results-table-sup {
          position: absolute ;
          padding-left: 2px ;
      }
  
      .jmv-results-table-table tbody tr:first-child td,
      .jmv-results-table-table tbody tr:first-child th[scope=row],
      .jmv-results-table-table tbody tr:first-child th[scope=rowgroup] {
          padding-top: 8px ;
      }
  
      .jmv-results-table-table tbody tr:last-child td,
      .jmv-results-table-table tbody tr:last-child th[scope=row],
      .jmv-results-table-table tbody tr:last-child th[scope=rowgroup] {
          padding-bottom: 8px ;
      }
  
      .jmv-results-table-table th[scope=col],
      .jmv-results-table-table th[scope=colgroup] {
          font-weight: normal ;
          min-width: 4em ;
          padding: 4px 8px ;
          white-space: nowrap ;
      }
  
      .jmv-results-table-table th[scope=row],
      .jmv-results-table-table th[scope=rowgroup] {
          font-weight: normal ;
          min-width: 4em ;
          padding: 4px 8px ;
          white-space: nowrap ;
          vertical-align: top;
          text-align: left;
      }
  
  
      .jmv-results-table-table > caption {
          border-bottom: 1px solid #333333 ;
      }
  
      .jmv-results-table-table thead th {
          border-bottom: 1px solid #333333 ;
      }
  
      .jmv-results-table-table thead .jmv-results-table-header-row-super th:empty {
          border-bottom: none ;
      }
  
      .jmv-results-table-table tbody tr:last-child td,
      .jmv-results-table-table tbody tr:last-child th[scope=row],
      .jmv-results-table-table tbody .jmv-results-table-cell-last-row {
          border-bottom: 2px solid #333333 ;
      }
  
      .jmv-results-error .jmv-results-table-table > caption,
      .jmv-results-error .jmv-results-table-table thead th[scope=col],
      .jmv-results-error .jmv-results-table-table thead th[scope=colgroup],
      .jmv-results-error .jmv-results-table-table tr:last-child td,
      .jmv-results-error .jmv-results-table-table tr:last-child th[scope=row],
      .jmv-results-error .jmv-results-table-table tr:last-child th[scope=rowgroup] {
          border-color: #AAAAAA ;
      }
  
      .jmv-results-table-cell-number,
      .jmv-results-table-cell-integer {
          font-family: "Segoe UI",Roboto,Helvetica,Arial,sans-serif;
          text-align: right ;
      }
  
      .jmv-results-table-cell-missing {
          text-align: left ;
      }
  
      th.jmv-results-table-cell-format-narrow,
      th[scope=col].jmv-results-table-cell-format-narrow,
      th[scope=colgroup].jmv-results-table-cell-format-narrow,
      td.jmv-results-table-cell-format-narrow {
          min-width: 0 ;
          padding-left: 4px ;
          padding-right: 4px ;
      }
  
      td.jmv-results-table-cell-group-begin,
      th[scope=row].jmv-results-table-cell-group-begin,
      th[scope=rowgroup].jmv-results-table-cell-group-begin {
          padding-top: 8px ;
      }
  
      td.jmv-results-table-cell-negative {
          color: #DD0000 ;
      }
  
      th.jmv-results-table-cell-format-sep,
      td.jmv-results-table-cell-format-sep {
          padding-left: 0 ;
          padding-right: 0 ;
          min-width: 0 ;
      }
  
      th[scope=col] button {
          display: inline-block ;
          width: 20px ;
          height: 16px ;
          background-color: transparent ;
          background-size: 20px 14px ;
          background-repeat: no-repeat;
          background-position: center 1px ;
          border: 0 ;
          outline: none;
      }
  
      th[scope=col] button.sort-asc {
          background-image: url('../assets/action-sort-asc.svg');
      }
  
      th[scope=col] button.sort-desc {
          position: relative ;
          left: -4px ;
          background-image: url('../assets/action-sort-desc.svg');
      }
  
      th[scope=col] button.sorted-asc {
          background-image: url('../assets/action-sorted-asc.svg');
      }
  
      th[scope=col] button.sorted-desc {
          position: relative ;
          left: -4px ;
          background-image: url('../assets/action-sorted-desc.svg');
      }
  
      th[scope=col] button.sort-asc:hover {
          background-image: url('../assets/action-sort-asc-hover.svg');
      }
  
      th[scope=col] button.sort-desc:hover {
          background-image: url('../assets/action-sort-desc-hover.svg');
      }
  
      table.row-selectable tr.content-row:hover:not(.selected) td,
      table.row-selectable tr.content-row:hover:not(.selected) th[scope=row],
      table.row-selectable tr.content-row:hover:not(.selected) th[scope=rowgroup]  {
          background-color: #F0F0F0 ;
      }
  
      table.row-selectable tr.selected td,
      table.row-selectable tr.selected th[scope=row],
      table.row-selectable tr.selected th[scope=rowgroup] {
          background-color: #6B9DE8 ;
          color: white ;
      }`;
    }

    render() {

        super.render();

        let table = this.__data.table;
        let columns = table.columns;
        let sortedCells = this.__sortedCells;
        let html;
        let fnIndices = {};
        let footnotes = [];

        //this._ascButtons.off();
        //this._descButtons.off();
        //this._trs.off();

        if (this.__data.status === 1)
            this.classList.add('jmv-results-status-inited');
        else if (this.__data.status === 2)
            this.classList.add('jmv-results-status-running');
        else {
            this.classList.remove('jmv-results-status-inited');
            this.classList.remove('jmv-results-status-running');
        }

        if (this.__data.title)
            this.__titleText.innerText = this.__data.title;

        let columnCount = 0;
        let rowCount = 0;

        for (let column of columns) {
            if (isVis(column))
                columnCount++;
        }

        if (columns.length > 0)
            rowCount = columns[0].cells.length;

        let hasSuperHeader = false;
        for (let column of columns) {
            if (isVis(column) && column.superTitle) {
                hasSuperHeader = true;
                break;
            }
        }

        let cells = {
            header: new Array(columnCount),
            superHeader: new Array(columnCount),
            body: new Array(rowCount)
        };

        let formattings = new Array(columnCount);

        let colNo = 0;
        let colIndex = -1;
        for (let column of columns) {
            colIndex += 1;
            if (!isVis(column))
                continue;

            let classes = '';
            let format = column.format.split(',');
            if (format.includes('narrow'))
                classes += ' jmv-results-table-cell-format-narrow';

            let name = column.name;
            let title = name;
            if ('title' in column)
                title = column.title;

            let sortable = column.sortable ? true : false;

            cells.header[colNo] = { name: name, value: column.title, colIndex: colIndex, type: column.type, classes: classes, sortable: sortable };

            if (column.superTitle)
                cells.superHeader[colNo] = { value: column.superTitle, classes: '' };

            let values = column.cells.map(v => v.d);
            formattings[colNo] = determFormat(values, column.type, column.format, this._context.format);

            colNo++;
        }

        for (let rowNo = 0; rowNo < rowCount; rowNo++) {

            cells.body[rowNo] = new Array(columnCount);

            if (columns.length === 0)
                break;

            let rowFormat = '';

            let colNo = 0;
            for (let sourceColNo = 0; sourceColNo < columns.length; sourceColNo++) {
                let sourceColumn = columns[sourceColNo];
                let sourceCells = sortedCells[sourceColNo];
                if (!isVis(sourceColumn))
                    continue;

                let sourceCell = sourceCells[rowNo];

                let cell = { value: null, type: sourceColumn.type, superTitle: sourceColumn.superTitle, colIndex: sourceColNo, classes: rowFormat, sups: '', visible: true, combineBelow: false, beginGroup: false };

                if (sourceCell.format & Format.NEGATIVE)
                    cell.classes += ' jmv-results-table-cell-negative';

                if (sourceCell.format & Format.INDENTED)
                    cell.classes += ' jmv-results-table-cell-indented';

                if ((sourceCell.format & Format.BEGIN_GROUP) === Format.BEGIN_GROUP)
                    cell.beginGroup = true;

                cell.visible = isVis(sourceColumn);

                if (sourceColumn.combineBelow)
                    cell.combineBelow = true;

                for (let symbol of sourceCell.symbols)
                    cell.sups += symbol;

                for (let i = 0; i < sourceCell.footnotes.length; i++) {
                    let footnote = sourceCell.footnotes[i];
                    let index = fnIndices[footnote];
                    if (index === undefined) {
                        index = Object.keys(fnIndices).length;
                        fnIndices[footnote] = index;
                        footnotes[index] = footnote;
                    }
                    cell.sups += SUPSCRIPTS[index];
                }

                switch (sourceCell.cellType) {
                    case 'i':
                        cell.value = sourceCell.i;
                        break;
                    case 'd':
                        let value = format(sourceCell.d, formattings[colNo]);
                        value = value.replace(/-/g, "\u2212").replace(/ /g, '<span style="visibility: hidden ;">0</span>');
                        cell.value = value;
                        break;
                    case 's':
                        cell.value = sourceCell.s;
                        break;
                    case 'o':
                        if (sourceCell.o == 2)
                            cell.value = 'NaN';
                        else
                            cell.value = '.';
                        break;
                }

                cell.classes += this.makeFormatClasses(sourceColumn);

                cells.body[rowNo][colNo] = cell;

                colNo++;
            }
        }

        let rowPlan = {};
        let foldedNames = [];
        let nFolds = 1;
        colNo = 0;

        for (let column of columns) {
            if (!isVis(column))
                continue;
            let columnName = column.name;
            let foldedName = columnName;
            let index = foldedName.indexOf('[');
            if (index !== -1)
                foldedName = foldedName.substring(0, index);

            if (foldedName in rowPlan) {
                let folds = rowPlan[foldedName];
                folds.push(colNo);
                nFolds = Math.max(nFolds, folds.length);
            }
            else {
                foldedNames.push(foldedName);
                rowPlan[foldedName] = [colNo];
            }
            colNo++;
        }

        if (nFolds > 1) {

            let newColumnCount = foldedNames.length;
            let newRowCount = rowCount * nFolds;

            let folded = {
                header: new Array(newColumnCount),
                superHeader: new Array(newColumnCount),
                body: new Array(newRowCount)
            };

            for (let colNo = 0; colNo < newColumnCount; colNo++) {
                let foldedName = foldedNames[colNo];
                let foldedIndices = rowPlan[foldedName];
                for (let index of foldedIndices) {
                    let header = cells.header[index];
                    folded.header[colNo] = header;
                    folded.superHeader[colNo] = cells.superHeader[index];
                    if (header.visible)
                        break;
                }
            }

            for (let rowNo = 0; rowNo < newRowCount; rowNo++)
                folded.body[rowNo] = new Array(newColumnCount);

            for (let rowNo = 0; rowNo < rowCount; rowNo++) {
                for (let colNo = 0; colNo < newColumnCount; colNo++) {
                    let foldedName = foldedNames[colNo];
                    let foldedIndices = rowPlan[foldedName];
                    for (let fold = 0; fold < foldedIndices.length; fold++) {
                        let index = foldedIndices[fold];
                        let row = folded.body[rowNo * nFolds + fold];
                        let cell = cells.body[rowNo][index];
                        row[colNo] = cell;
                    }
                }
            }

            // add spacing around the folds

            for (let rowNo = 0; rowNo < folded.body.length; rowNo += nFolds) {
                let row = folded.body[rowNo];
                for (let colNo = 0; colNo < row.length; colNo++) {
                    let cell = row[colNo];
                    if (cell)
                        cell.beginGroup = true;
                }
            }

            cells.header = folded.header;
            cells.superHeader = folded.superHeader;
            cells.body = folded.body;
        }

        for (let rowNo = 0; rowNo < cells.body.length; rowNo++) {
            let row = cells.body[rowNo];
            let first = row[0];
            if (first && first.beginGroup) {
                for (let colNo = 1; colNo < row.length; colNo++) {
                    let cell = row[colNo];
                    if (cell)
                        cell.beginGroup = true;
                }
            }
        }

        if (cells.body.length > 1 && cells.body[0].length > 0) {

            for (let colNo = 0; colNo < cells.body[0].length; colNo++) {
                if (!cells.body[0][colNo].combineBelow)
                    continue;

                let lastValue = '';

                for (let rowNo = 0; rowNo < cells.body.length; rowNo++) {
                    let cell = cells.body[rowNo][colNo];
                    if (cell === undefined)
                        continue;
                    let nowValue = cell.value;
                    if (cell.value === lastValue) {
                        cell.value = '';
                        cell.sups = '';
                    }
                    else {
                        lastValue = nowValue;
                    }
                }
            }
        }

        if (table.swapRowsColumns) {
            let swapped = {
                header: new Array(cells.body.length + 1),
                body: new Array(cells.header.length - 1)
            };
            //fix header
            swapped.header[0] = cells.header[0];
            for (let rowNo = 0; rowNo < cells.body.length; rowNo++) {
                swapped.header[rowNo + 1] = cells.body[rowNo][0];
                swapped.header[rowNo + 1].classes = "";
            }
            //fix cols
            for (let colNo = 0; colNo < cells.header.length - 1; colNo++) {
                swapped.body[colNo] = new Array(cells.body.length + 1);
                let cell = cells.header[colNo + 1];
                cell.sups = '';
                swapped.body[colNo][0] = cell;
            }
            //fix body
            for (let rowNo = 0; rowNo < swapped.body.length; rowNo++) {
                for (let colNo = 1; colNo < swapped.body[rowNo].length; colNo++)
                    swapped.body[rowNo][colNo] = cells.body[colNo - 1][rowNo + 1];
            }

            cells.header = swapped.header;
            cells.body = swapped.body;
        }

        html = '';

        if (hasSuperHeader) {

            let span = 1;
            for (let i = 0; i < cells.superHeader.length; i++) {
                let head = cells.superHeader[i];

                let nextHead = null;
                let nextContent = null;
                if (i < cells.superHeader.length - 1) {
                    nextHead = cells.superHeader[i + 1];
                    nextContent = '';
                    if (typeof (nextHead) !== 'undefined')
                        nextContent = nextHead.value;
                }

                let content = '';
                if (typeof (head) !== 'undefined')
                    content = head.value;

                if (content == nextContent) {
                    span++;
                }
                else {
                    html += '<th scope="colgroup" class="jmv-results-table-cell" colspan="' + (span) + '">' + content + '</th>';
                    span = 1;
                }
            }

            if (!this.__columnHeaderRowSuper) {
                this.__columnHeaderRowSuper = document.createElement('tr');
                this.__columnHeaderRowSuper.classList.add(`jmv-results-table-header-row-super`);
            }
            this.__columnHeaderRowSuper.innerHTML = html;
        }
        else if (this.__columnHeaderRowSuper) {
            this.__columnHeaderRowSuper.remove();
            this.__columnHeaderRowSuper = null;
        }


        html = '';

        for (let head of cells.header) {
            let content = head.value;
            if (content === '')
                content = '&nbsp;';
            let classes = head.classes;
            let sortStuff = '';
            if (head.sortable) {
                let asc = 'sort-asc';
                let desc = 'sort-desc';
                if (table.sortSelected && head.name === table.sortSelected.sortBy) {
                    if (table.sortSelected.sortDesc)
                        desc = 'sorted-desc';
                    else
                        asc = 'sorted-asc';
                }
                sortStuff = ' <button aria-label="Sort Column - Ascending" class="' + asc + '" data-name="' + head.name + '"></button><button class="' + desc + '" aria-label="Sort Column - decending" data-name="' + head.name + '"></button>';
            }
            html += '<th scope="col" class="jmv-results-table-cell' + classes + '">' + content + sortStuff + '</th>';
        }

        this.__columnHeaderRow.innerHTML = html;

        if (cells.header.length === 0) {
            this.__titleCell.setAttribute('colspan', '1');
            this.__titleCell.setAttribute('scope', 'col');
            return;
        }

        let nPhysCols = cells.header.length;

        if (cells.body.length === 0 || cells.body[0].length === 0) {
            this.__titleCell.setAttribute('colspan', nPhysCols.toString());
            if (nPhysCols > 1)
                this.__titleCell.setAttribute('scope', 'colgroup');
            else
                this.__titleCell.setAttribute('scope', 'col');

            this.__tableBody.innerHTML = '<tr><td colspan="' + nPhysCols + '">&nbsp;</td></tr>';
            return;
        }

        this.__titleCell.setAttribute('colspan', nPhysCols.toString());
        if (nPhysCols > 1)
            this.__titleCell.setAttribute('scope', 'colgroup');
        else
            this.__titleCell.setAttribute('scope', 'col');

        html = '';

        let rowHeadingCount = this.determineRowHeaderCount(cells);
        for (let rowNo = 0; rowNo < cells.body.length; rowNo++) {

            let rowHtml = '';
            for (let colNo = 0; colNo < cells.body[rowNo].length; colNo++) {

                let cell = cells.body[rowNo][colNo];
                let isRowHeader = colNo < rowHeadingCount;

                if (!cell || !cell.combineBelow || (cell && cell.value !== '')) { //skip cells that are blank

                    if (cell) {
                        let rowSpan = 1;
                        if (cell.combineBelow || colNo < rowHeadingCount) {
                            let rowIndex = rowNo + 1;
                            if (rowIndex < cells.body.length) {
                                let nextCell = cells.body[rowIndex][colNo];;
                                while (!nextCell || nextCell.value === '') {
                                    rowSpan += 1
                                    rowIndex += 1;
                                    if (rowIndex < cells.body.length)
                                        nextCell = cells.body[rowIndex][colNo];
                                    else
                                        break;
                                }
                            }
                        }

                        let content = cell.value;
                        let classes = cell.classes;
                        let lastRow = (rowNo + rowSpan) === cells.body.length;

                        if (lastRow)
                            classes += ' jmv-results-table-cell-last-row';

                        if (cell.beginGroup)
                            classes += ' jmv-results-table-cell-group-begin';

                        if (content === '')
                            content = '&nbsp;';

                        let interpretation = this.determineAriaLabel(content);

                        if (isRowHeader)
                            rowHtml += `<th ${rowSpan > 1 ? 'scope="rowgroup" rowspan="' + rowSpan + '"' : 'scope="row"'} ${interpretation ? 'aria-label="' + interpretation + '"' : ''} class="jmv-results-table-cell ${classes}">${content}<span class="jmv-results-table-sup">${cell.sups}</span></td>`;
                        else
                            rowHtml += `<td ${rowSpan > 1 ? 'rowspan="' + rowSpan + '"' : ''} ${interpretation ? 'aria-label="' + interpretation + '"' : ''}  class="jmv-results-table-cell ${classes}">${content}<span class="jmv-results-table-sup">${cell.sups}</span></td>`;
                    }
                    else if (colNo >= rowHeadingCount) { // don't add blank cells into heading area.
                        rowHtml += '<td>&nbsp;</td>';
                    }
                }
            }

            let selected = '';
            let trans = this.__sortTransform;
            if (table.rowSelected === trans[rowNo])
                selected = ' selected';

            html += '<tr class="content-row' + selected + '">' + rowHtml + '</tr>';
        }

        this.__tableBody.innerHTML = html;

        html = '';

        for (let i = 0; i < table.notes.length; i++)
            html += `<tr><td colspan="${nPhysCols}"><span style="font-style: italic ;">${_('Note')}.</span> ${table.notes[i].note}</td></tr>`;

        for (let i = 0; i < footnotes.length; i++)
            html += `<tr><td colspan="${nPhysCols}">${SUPSCRIPTS[i]} ${footnotes[i]}</td></tr>`;

        //html += `<tr><td colspan="${ nPhysCols }"></td></tr>`;
        this.__tableFooter.innerHTML = html;

        if (this.refs.hasVisibleContent()) {
            let refsRow = document.createElement('tr');
            refsRow.classList.add('jmvrefs');
            let refsRowData = document.createElement('td');
            refsRowData.setAttribute('colspan', nPhysCols.toString());
            refsRow.appendChild(refsRowData);
             // class="jmvrefs" excludes this from some exports/copy
             refsRowData.appendChild(this.refs);
             this.__tableFooter.append(refsRow);
         }
         else
             this.refs.remove();

        /*this._ascButtons = this.$tableHeader.find('button.sort-asc');
        this._descButtons = this.$tableHeader.find('button.sort-desc');
        this._trs = this.$tableBody.find('tr');

        this._ascButtons.on('click', event => {
            let $button = $(event.target);
            let columnName = $button.attr('data-name');
            this.model.sort(columnName, 'asc');
        });
    
        this._descButtons.on('click', event => {
            let $button = $(event.target);
            let columnName = $button.attr('data-name');
            this.model.sort(columnName, 'desc');
        });
    
        if (table.rowSelect) {
            this._trs.on('click', event => {
                let $row = $(event.target).closest(this._trs);
                let rowNo = this._trs.index($row);
                rowNo = this.sortTransform[rowNo];
                if (rowNo === table.rowSelected)
                   window.setOption(table.rowSelect, -1);
                else
                    window.setOption(table.rowSelect, rowNo);
            });
        }*/
    }

    determineRowHeaderCount(cells) {

        let head = cells.header[0];
        let headerValue = head.value;
        let hasRowHeaders = headerValue === '' && cells.body[0][0].type === 'text';
        hasRowHeaders = hasRowHeaders || cells.body[0][0].combineBelow;
        if (hasRowHeaders === false)
            return;

        let headingCount = 0;
        let includeNext = false;
        let rowHeadings = [];
        let currentSuperTitle = null;
        for (let colNo = 0; colNo < cells.body[0].length; colNo++) {
            let head = cells.header[colNo];
            let headerValue = head.value;
            let hasHeading = headerValue === '' && cells.body[0][colNo].type === 'text';
            hasHeading = hasHeading || cells.body[0][colNo].combineBelow;
            if (currentSuperTitle)
                hasHeading = hasHeading || cells.body[0][colNo].superTitle === currentSuperTitle;
            if (hasHeading || includeNext) {
                currentSuperTitle = cells.body[0][colNo].superTitle;
                includeNext = false;
                headingCount += 1;
            }
            else
                break;

            let lastCellValue = '';
            for (let rowNo = 0; rowNo < cells.body.length; rowNo++) {
                let cell = cells.body[rowNo][colNo];
                let cellValue = '';
                if (cell)
                    cellValue = cell.value;

                if (cellValue === '')
                    cellValue = lastCellValue;

                lastCellValue = cellValue;
                let newHeading = rowHeadings[rowNo] + ' ' + cellValue;
                if (rowHeadings.includes(newHeading))
                    includeNext = true;
                rowHeadings[rowNo] = newHeading;
            }
        }
        return headingCount;
    }

    determineAriaLabel(value) {
        if (typeof value !== 'string')
            return null;

        let items = value.split(' ✻ ');
        if (items.length === 1)
            return null;

        return this.termToAriaDescription(items);
    }

    termToAriaDescription(raw) {
        if (raw.length === 1)
            return raw[0];

        let first = raw[0];
        if (raw.length > 2) {
            for (let i = 1; i < raw.length - 1; i++) {
                first += ', ' + raw[i];
            }
        }
        let second = raw[raw.length - 1];
        return _('The interaction of {0} and {1}', [first, second]);
    }

    makeFormatClasses(column) {

        let classes = ' jmv-results-table-cell-' + (column.type ? column.type : 'number');

        if (column.format) {
            let formats = column.format.split(',');
            if (formats.length !== 1 || formats[0] !== '') {
                for (let i = 0; i < formats.length; i++)
                    formats[i] = 'jmv-results-table-cell-format-' + formats[i];
                classes += ' ' + formats.join(' ');
            }
        }
        return classes;
    }

    sort(by, dir) {

        let table = this.__data.table;

        let column = null;
        for (let c of table.columns) {
            if (c.name === by) {
                column = c;
                break;
            }
        }
        if (column === null)
            throw 'no such column';

        table.sortSelected = { sortBy: by, sortDesc: dir === 'desc' };

        let trans = createSortTransform(column, dir);
        this.__sortTransform = trans;

        let oldColumns = table.columns;
        let newColumns = new Array(oldColumns.length);

        for (let i = 0; i < oldColumns.length; i++) {
            let oldColumn = oldColumns[i];
            let newColumn = new Array(trans.length);
            for (let j = 0; j < trans.length; j++)
                newColumn[j] = oldColumn.cells[trans[j]];
            newColumns[i] = newColumn;
        }

        this.__sortedCells = newColumns;

        //window.setOption(table.sortSelect, { sortBy: by, sortDesc: dir === 'desc' });
    }


}

customElements.define('analysis-table', Table);