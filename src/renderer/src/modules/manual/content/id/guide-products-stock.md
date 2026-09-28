# Panduan: Produk, Kategori, dan Stok

Cara mengatur apa yang Anda jual, menjaga stok tetap benar, dan mencari tahu mengapa suatu angka bernilai demikian.

## 1. Kategori dulu (2 menit, hemat berjam-jam)

Kategori mengelompokkan produk untuk penyaringan dan laporan (misalnya *Bohlam*, *Saklar*, *Kabel*).

- **Inventory → Produk → tombol Kategori** membuka **Manage Categories**: tambah, ganti nama, tambah subkategori, atau arsipkan.
- **Tambah cepat saat membuat produk**: pada formulir produk, pilih **+ Create new category…**, ketik namanya (dan induknya jika itu subkategori) dan langsung dibuat serta dipilih.

## 2. Menambah produk

**Inventory → Produk → Add Product.**

| Kolom | Apa yang diisi |
|---|---|
| Nama Produk | Sebutan Anda dan pelanggan untuk produk ini |
| SKU / Barcode | Kode Anda sendiri, atau pindai barcode pabrikan |
| Kode HSN | Kode klasifikasi barang yang diberikan akuntan Anda (jasa memakai SAC) |
| Jenis Produk | **Standard** (stok dihitung) atau **Service** (tanpa stok, misalnya jasa) |
| Satuan | PCS, KG, L, M, BOX, dan sebagainya |
| Harga Pokok | Yang Anda bayar per satuan, **sebelum pajak** (biaya stok tidak pernah termasuk pajak pembelian) |
| Harga Jual | Yang Anda tagih per satuan. Sebelum pajak secara bawaan; termasuk pajak jika Anda mengaktifkan **Prices include tax** |
| MRP | Harga maksimum yang tercetak, jika ada (ditampilkan dicoret di samping harga Anda) |
| Tarif Pajak % | Tarif GST untuk produk ini. Ketik sendiri, atau klik tarif dari **Settings → Tax Configuration** |
| Tingkat / Jumlah Pemesanan Ulang | Tingkat stok yang memicu peringatan stok rendah, dan berapa yang biasa Anda pesan |
| Kuantitas Awal | Stok yang sudah Anda miliki saat menambahkan produk |

**Harga adalah sebelum pajak kecuali Anda tentukan lain.** Secara bawaan Sarang menambahkan pajak di atas saat Anda menjual atau membeli: harga jual 100 dengan pajak 18 persen terjual seharga 118. Jika harga rak Anda sudah termasuk pajak, aktifkan **Prices include tax** (di Settings, atau saklar pada setiap dokumen) dan Sarang menghitung pajaknya secara terbalik, sehingga Anda tidak perlu membagi secara manual. Lihat *Panduan: Pajak dan GST*.

Tarif pajak yang Anda tetapkan di sini otomatis terisi pada faktur, penawaran, pesanan penjualan, pesanan pembelian, tagihan pemasok, dan nota debit saat Anda memilih produk. Anda tetap bisa mengubahnya pada satu baris.

Varian (ukuran dan warna), penjualan berdasarkan berat, batch dengan kedaluwarsa, nomor seri atau IMEI, dan kit (beberapa produk dijual sebagai satu) diaktifkan oleh jenis usaha Anda atau di **Settings → Additional Business Features**.

## 3. Memasukkan stok

Stok naik **hanya** ketika salah satu dari ini terjadi:

1. **Receive Stock** pada Pesanan Pembelian yang disetujui.
2. **GRN** dengan baris tertaut ke produk yang **diposting (Posted)**.
3. **Kuantitas Awal** saat pertama kali membuat produk.
4. **Penyesuaian stok** (di bawah).
5. **Retur Penjualan** yang mengambil kembali barang, atau **produksi** selesai (untuk pabrikan).

**Tagihan Pemasok** saja tidak pernah menambah stok. Lihat *Panduan: Membeli dari Pemasok*.

## 4. Mengeluarkan stok

Stok turun saat Anda mengonfirmasi penjualan di Billing (atau Pesanan Penjualan difakturkan), saat **Nota Debit** mengembalikan barang, saat barang digunakan dalam produksi, atau saat Anda menyesuaikannya ke bawah.

Sarang tidak akan membiarkan Anda menjual lebih dari yang Anda miliki. Jika penjualan terblokir dengan *Insufficient stock*, terima dulu pembeliannya atau perbaiki penghitungan stok dengan alasan. Jika Anda benar-benar perlu menjual sebelum barang tercatat masuk, aktifkan stok negatif di **Settings → Business Features → Stock rules**; kuantitasnya kemudian ditampilkan di bawah nol sampai barang diterima.

## 5. Memeriksa dan mengoreksi stok

- **Inventory** mendaftar setiap produk dengan kuantitas saat ini, tingkat pemesanan ulang, biaya rata-rata, dan nilai stok. Tab **Low Stock** menunjukkan apa yang perlu dipesan.
- **Sesuaikan stok**: klik ikon sesuaikan pada suatu baris dan masukkan **kuantitas baru** (bukan selisihnya). Beri alasan (kerusakan, penghitungan, saldo awal). Saat menambah stok Anda dapat mencatat biaya unit yang ditambahkan.
- **Movements** (tombol di Inventory) adalah riwayat baca-saja setiap perubahan: Stock Added, Sale, PO Received, Adjustment, Sale Return, dan lainnya. Gunakan untuk menjawab "mengapa angka ini bernilai demikian?".
- **Menghitung stok**: **Inventory → Stock Counts → New count**. Sarang mengambil potret dari apa yang dikiranya Anda miliki untuk setiap barang; Anda mengetik apa yang benar-benar Anda hitung, dan ditampilkan selisih beserta nilainya. Tidak ada yang berubah sampai Anda menekan **Post**, yang mengubah setiap selisih menjadi penyesuaian stok (alasan: penghitungan stok) di lokasi utama Anda. Hanya satu penghitungan yang boleh terbuka sekaligus. Barang dengan batch, nomor seri, atau kedaluwarsa dihitung hanya berdasarkan kuantitas total. Jika posting terganggu, penghitungan tetap terbuka dan baris yang sudah diposting tetap diposting: tekan Post lagi untuk menyelesaikan sisanya. **Reports → Stock Count Variances** menunjukkan apa yang kurang atau lebih.
- **Stock Locations**: simpan stok terpisah untuk toko, gudang, atau mobil bak, dan pindahkan stok di antaranya.
- **Bin Locations**: **Inventory → Bin Locations** mencatat rak, susunan, atau boks mana (misalnya A-3-2) tempat setiap barang berada dalam suatu lokasi, agar siapa pun dapat menemukannya. Ini adalah label yang diketik manual: satu boks per barang per lokasi, dan hanya muncul di layar ini (belum di laporan atau daftar cetak).
- **Stock Journal**: **Inventory → Stock Journal** mencatat barang yang berubah bentuk, seperti memecah satu kardus menjadi beberapa paket: pilih apa yang keluar dan apa yang masuk lalu simpan bersamaan. Nilai yang keluar dibagi ke barang yang masuk berdasarkan kuantitas. Tidak bisa diedit atau dibatalkan setelah disimpan: perbaiki kesalahan dengan entri kebalikannya.
- **Dijanjikan pada pesanan**: **Inventory** dan laporan Stock Summary menunjukkan, di samping setiap barang, berapa yang dijanjikan pada Pesanan Penjualan yang terbuka. Ini pengingat, bukan penghalang: tidak ada yang mencegah Anda menjual stok yang sudah dijanjikan.

## 6. Memesan ulang sebelum kehabisan

- Tetapkan **Tingkat Pemesanan Ulang** pada setiap produk.
- Perhatikan ubin stok rendah di **Dashboard** dan peringatan lonceng. Peringatan stok rendah membuka **Inventory** saat diklik.
- Di layar **Inventory**, **Generate Reorder POs** membuat pesanan pembelian draf untuk semua yang di bawah tingkat pemesanan ulangnya, menggunakan pemasok bawaan setiap produk (tetapkan pemasok bawaan pada produk terlebih dahulu).

## 7. Berapa nilai stok saya?

**Inventory** menunjukkan nilai setiap produk (kuantitas x biaya rata-rata). **Reports → Stock Summary**, **Stock Ledger** (setiap pergerakan dengan pembukaan dan penutupan), **Inventory Ageing**, dan laporan stok per lokasi serta transfer menunjukkan penilaian, pergerakan, dan berapa lama barang tidak bergerak. Penilaian mengikuti metode yang Anda pakai (rata-rata, FIFO, dan lainnya jika diaktifkan) dan setiap laporan menyatakan berlaku per hari ini. Biaya pengiriman atau bea yang dimasukkan sebagai **landed cost** pada pembelian menaikkan biaya barang-barang itu.

## Kesalahan umum

| Kesalahan | Yang terjadi | Perbaikan |
|---|---|---|
| Mengetik barang baru pada GRN tanpa menautkannya | Stok tidak naik | Gunakan **+ Create product and link** pada baris sebelum memposting |
| Memasukkan harga jual termasuk pajak sementara Prices include tax mati | Pelanggan dikenakan pajak dua kali | Aktifkan **Prices include tax**, atau masukkan harga sebelum pajak |
| Tarif pajak dibiarkan 0 | Pajak hilang pada dokumen | Tetapkan tarifnya pada produk |
| Menyesuaikan stok berdasarkan selisih | Kuantitas salah | Masukkan kuantitas **total baru** |
| Menghapus produk yang memiliki riwayat | Tidak diizinkan | Arsipkan saja |

**Mencetak label rak dan pengiriman.** **Inventory → Print Labels** mencetak label barang; sebuah pengiriman memiliki **Print labels** dan **Track**, yang menampilkan garis waktunya sendiri untuk pengiriman, keterlambatan, dan penyerahan yang Anda perbarui sendiri (tidak ada umpan kurir langsung).
