import { utils, writeFile } from 'xlsx';
import { saveAs } from 'file-saver';

export const exportToExcel = (data, token) => {
  const ws = utils.json_to_sheet(data);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Links');
  const wbout = writeFile(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([wbout]), `${token}_links.xlsx`);
};

export const importFromExcel = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const wb = utils.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = utils.sheet_to_json(ws);
      resolve(json);
    };
    reader.readAsArrayBuffer(file);
  });
};
