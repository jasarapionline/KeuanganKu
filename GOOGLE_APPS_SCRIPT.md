# Google Apps Script CRUD Setup (PENTING)

### 1. Persiapan Struktur Google Sheet (WAJIB SAMA)
Buat dua sheet dalam satu file spreadsheet dengan **JUDUL KOLOM DI BARIS 1**:

**Sheet 1: `Data Transaksi`**
Baris 1 harus berisi: `id`, `tanggal`, `jenis`, `rekening`, `nominal`, `keterangan`

**Sheet 2: `Rekening`**
Baris 1 harus berisi: `nama`, `warna`

> **CATATAN:** Jika baris 1 langsung diisi data (tanpa judul kolom), aplikasi tidak akan bisa menampilkan data.

### 2. Kode Google Apps Script (`Code.gs`)
... (kode tetap sama seperti sebelumnya) ...

```javascript
function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const transactionSheet = ss.getSheetByName("Data Transaksi");
  const accountSheet = ss.getSheetByName("Rekening");
  
  const transactions = getSheetData(transactionSheet);
  const accounts = getSheetData(accountSheet);

  return ContentService.createTextOutput(JSON.stringify({ transactions, accounts }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const params = JSON.parse(e.postData.contents);
  const action = params.action;
  
  try {
    if (action === "add_transaction") {
      const sheet = ss.getSheetByName("Data Transaksi");
      const id = Utilities.getUuid();
      sheet.appendRow([id, params.tanggal, params.jenis, params.rekening, params.nominal, params.keterangan]);
    } 
    else if (action === "edit_transaction") {
      const sheet = ss.getSheetByName("Data Transaksi");
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === params.id) {
          sheet.getRange(i + 1, 2, 1, 5).setValues([[params.tanggal, params.jenis, params.rekening, params.nominal, params.keterangan]]);
          break;
        }
      }
    }
    else if (action === "delete_transaction") {
      const sheet = ss.getSheetByName("Data Transaksi");
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === params.id) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
    }
    else if (action === "add_account") {
      const sheet = ss.getSheetByName("Rekening");
      sheet.appendRow([params.nama, params.warna]);
    }
    else if (action === "edit_account") {
      const sheet = ss.getSheetByName("Rekening");
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === params.oldNama) {
          sheet.getRange(i + 1, 1, 1, 2).setValues([[params.nama, params.warna]]);
          break;
        }
      }
    }
    else if (action === "delete_account") {
      const sheet = ss.getSheetByName("Rekening");
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === params.nama) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getSheetData(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  return rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      let val = row[i];
      if (val instanceof Date) val = val.toISOString();
      obj[header.toLowerCase()] = val;
    });
    return obj;
  });
}
```

### 3. Deploy Ulang
Setiap kali Anda mengubah kode di Apps Script, Anda **HARUS** melakukan **New Deployment** dan memperbarui URL di dashboard.
