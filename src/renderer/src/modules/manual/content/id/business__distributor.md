# Distributor / Wholesale

Memilih **Distributor** sebagai jenis bisnis Anda mengaktifkan **penerapan batas kredit**, **entri pesanan grosir**, **analitik tertunggak**, dan set modul **Logistics** bersama. Semua yang lain — Billing, Products, Customers, Inventory, Reports — bekerja persis seperti dijelaskan di bab-bab tersebut; bab ini membahas apa yang khusus untuk bisnis distributor/grosir.

## Bulk Order Entry

Buka **Bulk Order Entry** dari sidebar untuk menyusun pesanan grosir besar dengan cepat — cari dan tambahkan produk satu per satu (setiap baris baru default ke kuantitas 1 dan harga jual normalnya), lalu sesuaikan kuantitas secara langsung. Harga volume berlaku otomatis per baris berdasarkan kuantitas yang dipesan:

- 10+ unit → diskon 5%
- 50+ unit → diskon 10%
- 100+ unit → diskon 15%

Tingkatan tertinggi yang memenuhi syarat baris tersebut yang berlaku; kuantitas kecil biasa tidak mendapat diskon. Cari dan lampirkan pelanggan grosir ke pesanan tersebut (wajib jika Anda memilih Kredit sebagai metode pembayaran — pesanan Tunai, UPI, dan Kartu tidak memerlukan pelanggan), secara opsional catat referensi pesanan dan catatan pengiriman, lalu kirim — ini membuat sebuah faktur normal yang akan Anda temukan nanti di Faktur, ditandai dengan referensi pesanan grosir dalam catatannya.

## Harga negosiasi pelanggan

Kelompokkan pelanggan ke dalam sebuah **kelas pelanggan** (dari catatan mereka di Pelanggan — mis. "Grosir", "Pengecer") dan atur harga khusus-kelas per produk dari layar **Customer Pricing** yang baru. Setelah diatur, Bulk Order Entry (dan pesanan sales lapangan di bawah) otomatis memberi harga keranjang pelanggan tersebut pada tarif negosiasi mereka alih-alih harga jual biasa — pelanggan tanpa harga kelas yang tercatat cukup ditagih pada harga daftar seperti biasa.

## Perencanaan rute / beat

Sebuah pengiriman (shipment) dapat membawa beberapa **pemberhentian (stops)** alih-alih hanya satu alamat tujuan — buka detail sebuah pengiriman dan tambahkan setiap pemberhentian di sepanjang rute dengan alamat dan status pengirimannya sendiri, sehingga satu perjalanan multi-drop dilacak sebagai rute sesungguhnya, bukan satu tujuan dengan segala sesuatunya dianggap terkirim sekaligus.

## Penangkapan pesanan sales lapangan

Aktifkan **Field Order Capture** untuk membiarkan sales lapangan Anda mengirim pesanan dari ponsel mereka sendiri saat mengunjungi pelanggan, lewat WiFi toko Anda — tanpa perlu instal aplikasi. Buka **Field Orders** untuk melihat tautan LAN/kode QR yang dibagikan ke sales, serta untuk **Accept** atau **Reject** permintaan yang masuk. Seorang sales hanya memilih produk dan kuantitas — Sarang selalu memeriksa ulang harga negosiasi pelanggan yang sebenarnya (dan batas kredit Anda) pada saat Anda menerima (accept), bukan apa pun yang diperkirakan ponsel sales tersebut, sehingga faktur yang benar-benar dibuat selalu diberi harga dengan benar.

## Outstanding Analytics

Buka **Outstanding Analytics** untuk melihat total eksposur kredit Anda di seluruh pelanggan grosir dengan saldo belum lunas: total tertunggak, berapa banyak pelanggan yang saat ini melebihi batas kredit mereka, dan rata-rata saldo tertunggak per pelanggan. Rincian **aging** menunjukkan berapa lama setiap rupiah telah tertunggak — Current, 1–30 hari, 31–60 hari, 61–90 hari, 90+ hari — sehingga Anda bisa melihat bukan hanya berapa yang terutang tetapi seberapa terlambat itu. Daftar pelanggan di bawah menunjukkan batas kredit masing-masing, saldo tertunggak saat ini (dengan progress bar menuju batas mereka), dan angka 90+ hari mereka, dan diurutkan sehingga siapa pun yang melebihi batasnya menonjol dengan warna merah. Ketuk pelanggan mana pun untuk melompat ke catatan lengkap mereka.

## Penerapan batas kredit

Berikan seorang pelanggan **batas kredit** dari catatannya di **Pelanggan**, dan Sarang memblokir penjualan *kredit* baru mana pun (dari Billing atau Bulk Order Entry) yang akan mendorong saldo tertunggak mereka melebihi batas itu — ditolak langsung saat disimpan dengan pesan yang menunjukkan saldo tertunggak mereka, jumlah faktur baru, dan batas mereka. Ini hanya berlaku untuk penjualan metode Kredit; penjualan Tunai, UPI, Kartu, dan Split-payment tidak terpengaruh. Batas kredit 0 berarti tidak ada batas yang diterapkan.

## Logistics & Supply Chain

Karena template default Distributor mencakup modul Logistics, Anda juga mendapatkan **Fleet**, **Carriers**, **Shipments**, **GRN**, **Delivery Challan**, **Freight Ledger**, dan **Logistics Analytics** untuk melacak kendaraan pengiriman Anda sendiri dan pengiriman dari pemasok — lihat layar Logistics di bawah nama-nama tersebut di sidebar.

## Yang dibagikan dengan setiap bisnis

Billing, invoicing, payments, Customers, Products, Reports, Backup, dan Users & Permissions semuanya bekerja persis seperti dijelaskan di bab masing-masing.
