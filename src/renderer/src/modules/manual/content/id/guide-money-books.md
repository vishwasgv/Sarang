# Panduan: Uang dan Pembukuan Anda

Bagaimana hal-hal sehari-hari yang Anda lakukan (menjual, membeli, membayar, mengeluarkan biaya) menjadi pembukuan Anda, dan cara membaca laporannya. Ini untuk catatan dan perencanaan Anda sendiri; bukan pengganti nasihat akuntan Anda.

## 1. Bagaimana pekerjaan sehari-hari Anda menjadi pembukuan Anda

Anda tidak perlu membuat jurnal akuntansi untuk pekerjaan biasa. Sarang mencatatnya untuk Anda:

| Anda melakukan ini | Sarang mencatat |
|---|---|
| Melakukan penjualan (faktur) | Uang yang terutang pelanggan (atau kas/bank jika dibayar), pendapatan penjualan, dan pajak yang dipungut |
| Menerima pembayaran | Kas atau bank naik, yang terutang pelanggan turun |
| Menerima stok pada Pesanan Pembelian | Stok dan yang terutang ke pemasok naik |
| Mencatat Faktur Pemasok | Yang terutang ke pemasok naik; biaya atau stok dicatat |
| Membayar pemasok | Kas atau bank turun, yang terutang turun |
| Mencatat Pengeluaran | Pengeluaran naik, kas atau bank turun (atau yang terutang naik) |
| Menerbitkan Nota Kredit atau Nota Debit | Penjualan atau pembelian berkurang, begitu pula saldonya |
| Mencatat penyusutan Aset Tetap | Beban penyusutan naik, nilai aset turun |
| Pelanggan menahan TDS saat membayar | Faktur dianggap lunas; "TDS Piutang" (pajak yang akan Anda klaim kreditnya) naik menggantikan kas |
| Membayar GST ke pemerintah (Accounting, GST Payments) | Pajak terutang dan kredit masukan yang digunakan turun, kas atau bank turun |
| Menyetujui dan mengganti klaim biaya staf | Pengeluaran biasa dicatat dan kas atau bank turun |

Setiap jurnal punya dua sisi yang selalu sama (debit sama dengan kredit). Itulah sebabnya pembukuan seimbang.

## 2. Bagan Akun (Chart of Accounts)

**Accounting → Chart of Accounts** adalah daftar akun yang digunakan pembukuan Anda, dalam kelompok: Aset (kas, bank, piutang, stok, aset tetap), Kewajiban (utang usaha, pajak terutang, pinjaman), Ekuitas (modal dan laba Anda), Pendapatan dan Beban. Sarang membuat akun standar untuk Anda. Tambahkan akun Anda sendiri (misalnya pinjaman bank baru atau beban khusus) dengan **Add Account**.

Klik **Ledger** pada akun mana pun untuk melihat setiap jurnal di dalamnya (lihat bagian 5).

## 3. Jurnal Umum: penyesuaian yang bukan penjualan atau pembelian

**Accounting → Journal Entries → New.** Gunakan jurnal umum untuk hal yang bukan penjualan atau pembelian biasa: saldo awal, penghapusan, pemilik menyetor atau menarik uang, koreksi jurnal sebelumnya. Tambahkan baris, masing-masing dengan akun dan debit atau kredit. **Total debit harus sama dengan total kredit** atau Sarang tidak akan menyimpannya. Entri yang sudah diposting dapat dibalik (dengan alasan), bukan dihapus, sehingga selalu ada jejaknya.

Bantuan pada formulir jurnal:

- **Templat (pola)**: setelah Anda mengisi akun dan sisi masing-masing, simpan susunannya dengan nama (misalnya *Sewa Bulanan*). Lain kali pilih templat itu dan cukup ketik jumlahnya. Menyimpan dengan nama yang sudah ada akan menggantikannya.
- **Balik otomatis pada**: untuk akrual (beban yang Anda catat sekarang tetapi menjadi milik bulan depan), pilih tanggal jurnal harus membalik dirinya sendiri. Sarang melakukannya saat pertama kali dibuka pada atau setelah tanggal itu, dengan tanggal hari jurnal dijalankan. Jika periode terkunci, pembalikan menunggu.
- **Catatan memorandum** (bagian lipat di bawah Journal Entries): catatan tentang hal-hal yang belum menjadi jurnal akuntansi, seperti barang yang dikirim untuk persetujuan. Catatan ini tidak pernah mengubah pembukuan Anda.
- **Keyboard**: tekan **Enter** pada jumlah terakhir untuk menambah baris penyeimbang dan **Ctrl + Enter** untuk memposting.

## 4. Uang di bank

- **Rekening Bank**: tambahkan setiap rekening bank, lalu **Reconcile**: impor atau ketik baris rekening koran dan cocokkan dengan yang sudah dicatat Sarang, agar pembukuan Anda sesuai dengan bank.
- **Cek Mundur (Post-Dated Cheques)**: lacak cek yang Anda berikan atau terima untuk tanggal kemudian.
- **Setoran Bank**: catat setoran uang tunai dan cek ke bank.
- **Tutup Kas** (harian): hitung uang tunai di laci dan catat selisihnya.
- **Aturan Bank** (Accounting → Bank Rules): beri tahu Sarang bahwa baris rekening koran yang mengandung kata tertentu (misalnya "listrik") termasuk ke akun tertentu. Layar menampilkan baris rekening koran yang diimpor dan sesuai dengan aturan; satu klik memposting ke akun itu dan menandainya sudah direkonsiliasi. Aturan tidak pernah berjalan sendiri dan baris yang sudah diposting dapat dibatalkan dari layar rekonsiliasi.
- **Pengeluaran**: catat setiap biaya usaha dengan kategori, vendor, dan apakah pajaknya menjadi tanggungan Anda (reverse charge).
- **Klaim Biaya (Expense Claims)** (Accounting → Expense Claims): ketika staf membayar sesuatu dari kantong sendiri, catat klaimnya, lalu **Approve** (atau **Reject**) dan **Repay**. Membayar kembali mencatat pengeluaran biasa dengan metode pembayaran yang Anda pilih.

## 5. Laporan, dan cara membaca masing-masing

Buka **Reports** dan pilih grup **Financial**. Pilih rentang tanggal dan jalankan laporannya. Setiap laporan punya baris ringkasan, grafik, dan tabel; Anda dapat mencetak, mengekspor ke Excel atau PDF, atau membagikannya.

**Laporan Laba Rugi (Profit and Loss Statement).** Pendapatan dikurangi biaya untuk satu periode: pendapatan, harga pokok penjualan, laba kotor, beban per kategori, laba bersih. *Pertanyaan yang dijawab:* apakah saya untung bulan ini?

**Bagaimana stok muncul dalam pembukuan Anda.** Sarang mengelola stok seperti Tally dan Zoho Books. Barang yang Anda beli melalui faktur pemasok (atau Pesanan Pembelian yang diterima) masuk ke aset **Inventaris**, bukan ke beban. Saat menjual, harga pokok barang yang terjual keluar dari Inventaris menjadi **Harga Pokok Penjualan**, menggunakan biaya pada saat penjualan. Retur mengembalikan barang pada biaya itu. Jasa pada faktur (pengiriman, sewa) adalah beban. Selisih stok opname, kerusakan, atau kedaluwarsa dibukukan ke Harga Pokok Penjualan. Stok yang Anda ketik manual (stok awal) dibukukan ke Modal Pemilik. Karena itu Neraca, laporan Laba Rugi, dan laporan Penjualan menceritakan cerita yang sama. Jika Anda memutakhirkan dari versi lama, stok Anda yang sudah ada dimasukkan ke pembukuan satu kali pada biaya, saat pertama kali dijalankan; penjualan yang dilakukan sebelum pemutakhiran tidak memiliki jurnal harga pokok penjualan, jadi mulai periode Laba Rugi pertama Anda dari tanggal pemutakhiran.

**Neraca (Balance Sheet).** Apa yang dimiliki dan diutang bisnis **pada satu tanggal**: aset di satu sisi, kewajiban ditambah ekuitas Anda di sisi lain, dan baris pemeriksaan yang menunjukkan keduanya sama. Laba periode berjalan dimasukkan ke ekuitas agar seimbang. Pilih **Compare with** tanggal sebelumnya untuk melihat apa yang berubah. *Pertanyaan yang dijawab:* berapa nilai bisnis saya di atas kertas, dan berapa yang diutang?

**Laporan Arus Kas (Cash Flow Statement).** Dari mana kas berasal dan ke mana perginya dalam satu periode: dari menjalankan bisnis (operasi), dari membeli atau menjual aset (investasi), dan dari pinjaman serta uang pemilik (pendanaan), dari kas awal hingga kas akhir. Lencana "reconciled" menunjukkan kas akhir sesuai dengan rekening kas dan bank Anda. *Pertanyaan yang dijawab:* saya untung, jadi mengapa tidak ada uang tunai?

**Neraca Saldo (Trial Balance).** Total debit atau kredit setiap akun untuk periode itu. Jika debit sama dengan kredit, pembukuan seimbang. Klik baris mana pun untuk membuka buku besar akun itu.

**Buku Besar (General Ledger).** Pilih satu akun dan rentang tanggal. Anda mendapatkan saldo awal, setiap jurnal dengan saldo berjalan, dan saldo akhir, masing-masing dengan dokumen asalnya (faktur, tagihan, pembayaran, jurnal). Faktur dan tagihan langsung terhubung ke dokumennya. Buka dari **Chart of Accounts → Ledger**, dari baris **Trial Balance**, atau dari daftar Reports. *Pertanyaan yang dijawab:* mengapa akun ini menunjukkan angka ini?

**Buku Harian (Day Book).** Setiap entri berdasarkan urutan tanggal, dapat disaring berdasarkan jenis (penjualan, pembelian, penerimaan, pembayaran, jurnal). Total per hari. *Pertanyaan yang dijawab:* apa yang terjadi pada hari ini?

**Buku Kas (Cash Book).** Catatan harian setiap pembayaran yang diterima dan setiap pembayaran atau pengeluaran yang dilakukan, dengan saldo berjalan.

**Laporan lain untuk akuntan Anda dan untuk Anda** (semua ada di daftar Reports, masing-masing dengan grafik):

- **Analisis Rasio (Ratio Analysis)** (likuiditas, utang, margin, hari piutang, pemasok dan stok) dan **Arus Dana (Fund Flow)** (sumber dan penggunaan dana).
- **Buku Bank (Bank Book)** dan **Ringkasan Rekonsiliasi Bank**.
- **Ringkasan Piutang** dan **Ringkasan Utang** (siapa berutang apa dan apa yang jatuh tempo dalam 7 hari ke depan), **Laba per Barang** dan **Laba per Pelanggan**, **Tahun ke Tahun**.
- **Laba per Kategori Biaya** (pendapatan, beban, dan laba dijumlahkan berdasarkan kategori yang Anda beri pada setiap pusat biaya) dan **Anggaran vs. Realisasi (Budget vs. Actual)**.
- **Beban per Kategori** dan **Beban per Vendor**, **Register Aset Tetap**.
- **Register Nota Kredit, Nota Debit, dan Retur Penjualan**.
- **TDS Dipotong**, **TDS Piutang**, dan (untuk usaha ber-GST) **GST Net Payable & Input Credit**.

Beberapa laporan juga dapat disimpan otomatis ke folder sesuai jadwal (Settings → Business Features → Reports saved automatically); ini hanya berjalan selama Sarang terbuka.

## 6. Pemeriksaan yang layak dilakukan setiap bulan

1. **Trial Balance**: debit sama dengan kredit.
2. **Neraca**: aset sama dengan kewajiban ditambah ekuitas.
3. **Rekonsiliasi bank**: saldo bank di Sarang sama dengan rekening koran.
4. **Piutang dan Utang**: laporan Outstanding dan AP Aging Summary sesuai dengan saldo pelanggan dan pemasok.
5. **Nilai stok**: total Inventaris masuk akal dibandingkan penghitungan terakhir Anda.
6. Kirim **Laba Rugi**, **Neraca**, dan **Tax Report** bulan itu ke akuntan Anda.

## Anggaran, pusat biaya, dan beberapa toko

- **Pusat Biaya** menandai pendapatan dan beban berdasarkan departemen atau proyek. Beri setiap pusat biaya sebuah **kategori** (misalnya Departemen atau Proyek) dan **Profit by Cost Category** menjumlahkannya.
- **Anggaran** menetapkan jumlah yang direncanakan per bulan. Di samping rencana nyata Anda (**Base plan**) Anda dapat membuat **rencana what-if**: pilih **New what-if plan**, beri nama, lalu naikkan atau turunkan setiap angka dengan persentase. **Budget vs. Actual** mengikuti rencana yang Anda pilih.
- **Punya beberapa toko atau cabang?** Setiap toko punya Sarang sendiri. **Accounting → Branch Summaries** mengekspor berkas ringkasan dari setiap toko dan mengimpornya ke satu tempat agar pemilik dapat melihat semua toko bersama-sama. Tidak ada yang tersinkron sendiri.

## Mata uang asing

Simpan tabel nilai tukar di **Settings → Business Features → Exchange rates** (tambahkan kurs secara manual atau impor CSV). Saat Anda melakukan penjualan dalam mata uang asing, kurs terbaru terisi otomatis. Pembayaran yang diterima dalam mata uang itu mencatat laba atau rugi selisih kurs.

## 7. Mengunci periode yang sudah selesai

**Accounting → Ledger Settings** memungkinkan Anda menetapkan **tanggal kunci**. Tidak ada yang bertanggal pada atau sebelum tanggal itu yang dapat ditambah, diubah, atau dibalik, yang melindungi angka yang sudah digunakan akuntan Anda untuk SPT atau audit. Tetapkan hanya setelah akuntan Anda mengonfirmasi periode itu.

## 8. Akhir tahun

**Fixed Assets and Year-End Close** (bab tersendiri) membahas pencatatan penyusutan dan penutupan tahun. Setelah penutupan, saldo awal tahun baru dibawa maju secara otomatis. Laporan yang menunjukkan saldo pada suatu tanggal dimulai dari entri pembukaan terbaru.

## Membagikan pembukuan Anda dengan akuntan

Buat login untuk akuntan Anda dengan peran **Accountant**: dapat melihat laporan, buku besar, dan pernyataan serta mengekspornya, dan tidak dapat mengubah apa pun. Tambahkan di **Settings → Users**. Kirim Laba Rugi, Neraca, dan Tax Report bulan itu, atau ekspor Trial Balance untuk mereka.

## Pertanyaan umum

**Mengapa laba tidak sama dengan uang tunai yang saya miliki?** Laba menghitung penjualan yang belum Anda terima dan pembelian yang belum Anda bayar. Laporan Arus Kas menunjukkan selisihnya.

**Mengapa Neraca saya tidak seimbang?** Seharusnya tidak pernah demikian. Jika terjadi, jangan perbaiki secara manual: periksa apakah ada kunci periode di tengah rentang, catat selisihnya, dan telusuri di Buku Besar bersama akuntan Anda.

**Bisakah saya menghapus entri?** Entri dibalik, bukan dihapus, sehingga catatannya tetap lengkap. Gunakan Void, Cancel, Reverse, atau Nota Kredit/Debit sesuai yang ditawarkan layar.
