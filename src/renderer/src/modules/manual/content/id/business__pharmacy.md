# Pharmacy

Memilih **Pharmacy** sebagai jenis bisnis Anda mengaktifkan **pelacakan batch**, **pelacakan kedaluwarsa**, dan set modul **Logistics** bersama. Semua yang lain — Billing, Products, Customers, Inventory, Reports — bekerja persis seperti dijelaskan di bab-bab tersebut; bab ini membahas apa yang khusus untuk sebuah apotek.

## Batch Management

Buka **Batch Management** dari sidebar untuk mencatat setiap batch stok yang Anda terima: produk, nomor batch/lot, kuantitas diterima, tanggal kedaluwarsa, tanggal produksi opsional, biaya satuan, dan dari pemasok mana asalnya. Setiap batch melacak **kuantitas tersisa**-nya sendiri secara terpisah dari apa yang awalnya diterima, dan daftar dapat difilter menjadi **All**, **Expiring Soon**, atau **Expired**. Pil peringatan di bagian atas layar menandai berapa banyak batch yang akan kedaluwarsa dalam 30 hari atau sudah kedaluwarsa, sehingga pemeriksaan stok tidak pernah menjadi kejutan. Anda dapat mengedit tanggal kedaluwarsa, tanggal produksi, kuantitas tersisa, atau biaya sebuah batch nanti, atau menonaktifkan sebuah batch setelah sepenuhnya terpakai atau dihapuskan.

## Bagaimana penjualan menarik dari batch

Anda tidak memilih batch secara manual saat penjualan — Billing menarik dari stok batch Anda secara otomatis, batch yang paling dulu kedaluwarsa terlebih dahulu (FIFO berdasarkan tanggal kedaluwarsa), untuk produk mana pun yang memiliki batch tercatat. Jika satu-satunya stok batch yang tersedia untuk menutupi sebuah penjualan sudah kedaluwarsa, Sarang memblokir penjualan tersebut secara default alih-alih diam-diam membiarkan stok kedaluwarsa keluar dari pintu — Anda perlu mencatat batch baru yang valid, atau (hanya jika benar-benar disengaja) mengaktifkan "Allow expired batch sale" di Settings untuk menimpa ini. Retur pada produk yang dilacak-batch mengembalikan kuantitas ke batch yang benar dengan cara yang sama, sehingga angka kuantitas-tersisa tetap akurat setelah sebuah retur.

## Obat resep Schedule H/H1

Tandai sebuah produk **Prescription Required** pada formulir Produk-nya, dan Billing akan mewajibkan nama pasien dan nama dokter yang meresepkan sebelum mengizinkan Anda menambahkannya ke keranjang — penjualan tersebut tidak bisa diselesaikan tanpa keduanya, menjaga Anda tetap patuh terhadap persyaratan pencatatan Schedule H/H1. Sebuah laporan khusus **Prescription Drug Sales Register** (khusus Pharmacy) mendaftar setiap penjualan semacam itu beserta detail pasien/dokter yang tercatat.

## Nomor lisensi obat

Masukkan **Drug License Number** apotek Anda di bawah Settings → Business Profile — kolom ini khusus untuk jenis bisnis ini dan hanya muncul saat Pharmacy adalah jenis bisnis aktif Anda.

## Pemesanan ulang otomatis dari stok rendah

Atur **Default Supplier** pada sebuah produk (di samping Reorder Level/Quantity-nya pada formulir Produk), dan ketika produk itu menipis, gunakan **Generate Reorder POs** pada bilah peringatan stok-rendah di Inventory. Sarang menyusun draf satu pesanan pembelian per pemasok, mengelompokkan setiap produk yang jatuh tempo dan memiliki pemasok default terkonfigurasi, dan melewati apa pun yang sudah ada di sebuah PO terbuka sehingga menjalankannya lagi tidak pernah membuat duplikat — produk tanpa pemasok default yang diatur juga dilewati, dengan sebuah hitungan ditampilkan sehingga Anda tahu apa yang masih perlu perhatian manual.

## Logistics & Supply Chain

Karena template default Pharmacy mencakup modul Logistics, Anda juga mendapatkan **Fleet**, **Carriers**, **Shipments**, **GRN**, **Delivery Challan**, **Freight Ledger**, dan **Logistics Analytics** untuk melacak kendaraan pengiriman Anda sendiri dan pengiriman dari pemasok — lihat layar Logistics di bawah nama-nama tersebut di sidebar.

## Yang dibagikan dengan setiap bisnis

Billing, invoicing, payments, Customers, Products, Reports, Backup, dan Users & Permissions semuanya bekerja persis seperti dijelaskan di bab masing-masing.
