# Toko Roti / Toko Kue / Katering

## Apa yang berbeda pada jenis usaha ini

Toko roti menjual barang yang cepat laku dan berumur simpan pendek yang dibuat dari resep (tepung, gula, mentega dikurangi setiap kue terjual), menerima pesanan khusus untuk kue yang dipesan lebih dulu, dan sering menangani pesanan katering untuk acara — 50 samosa dan 20 cupcake untuk sebuah pesta, dicocokkan dengan katalog dan ditagih sekaligus. Toko Roti menggabungkan pelacakan resep/bahan dari Restoran (tanpa alur meja/KOT makan di tempat — penjualan di kasir bukan tiket), pelacakan batch/kedaluwarsa dari Apotek untuk umur simpan pendek, dan mekanisme pesanan daftar massal dari Alat Tulis yang digunakan kembali apa adanya untuk katering.

## Pengurangan Bahan Berbasis Resep

Atur Resep pada Produk panggangan apa pun (Produk → Resep) sama seperti hidangan Restoran — daftar setiap bahan dan berapa banyak yang digunakan per unit. Karena penjualan di kasir toko roti tidak memiliki alur tiket dapur, stok bahan dikurangi otomatis saat penjualan ditagih, bukan pada langkah terpisah "pesanan selesai".

## Pesanan Khusus

Buka **Custom Orders** di bilah sisi untuk memesan kue khusus atau pesanan sesuai permintaan: pilih pelanggan, tambahkan setiap item dengan kuantitas dan harganya, dan opsional catat kustomisasi untuk satu baris — rasa, ukuran, pesan, atau desain. Tetapkan jumlah uang muka dan cara pembayarannya; uang muka tidak boleh melebihi total pesanan.

Saat pesanan siap, gunakan **Generate Invoice** pada pesanan — ini membuat faktur sebenarnya dari item pesanan itu sendiri dan secara otomatis mencatat uang muka yang sudah dikumpulkan sebagai pembayaran nyata terhadapnya.

## Pesanan Katering dengan Daftar Massal

Buka **Bulk-List Orders** (layar yang sama yang digunakan Alat Tulis untuk daftar perlengkapan sekolah) untuk menangani pesanan katering: catat setiap baris sebagai teks bebas ("50 samosa", "20 cupcake"), cocokkan masing-masing dengan produk katalog sebenarnya, dan tagih seluruh pesanan sekaligus setelah setiap baris dicocokkan.

## Acara Katering

Buka **Acara Katering** di bilah sisi untuk pemesanan acara penuh — pernikahan atau acara besar, bukan pesanan massal di hari yang sama. Pilih pelanggan, tanggal mulai (dan selesai, untuk acara multi-hari) acara, alamat lokasi, dan jumlah tamu, lalu tetapkan **harga per porsi** sebagai penawaran awal. Tambahkan menu acara (produk katalog sebenarnya dengan kuantitas dan harga), jumlah makan dan camilan untuk setiap hari layanan, dan staf dengan biaya per perannya sendiri — juru masak, pelayan, petugas kebersihan, atau lainnya, masing-masing dengan jumlah pekerja dan tarif per pekerjanya sendiri.

Setelah harga benar-benar dinegosiasikan, gunakan **Catat Harga Akhir** untuk mencatat total yang disepakati — dijaga terpisah dari penawaran harga per porsi asli, sehingga diskon yang dinegosiasikan selalu terlihat alih-alih ditimpa secara diam-diam. **Buat Faktur** pada acara menagih pada harga akhir yang dinegosiasikan jika telah dicatat, atau penawaran asli jika tidak, sebagai satu baris Layanan Katering, dan mencatat uang muka yang sudah dikumpulkan sebagai pembayaran nyata terhadapnya.

## Laporan

Selain laporan standar Penjualan, Inventaris, dan Keuangan, Toko Roti mendapatkan:

- **Umur Simpan / Pemborosan** — stok yang dihapusbukukan karena kedaluwarsa (gunakan alasan **Kedaluwarsa** saat menyesuaikan stok untuk barang kedaluwarsa), per produk dan nilai — laporan yang sama yang digunakan Sembako untuk barang mudah rusak.
- **Margin Resep** — laporan Biaya Makanan dan Margin Kontribusi Hidangan (dari pelacakan bahan Restoran) bekerja di sini tanpa perubahan, karena pengurangan bahan toko roti dicatat dengan cara yang persis sama.
- **Lembar Produksi Pra-Pesanan** — pilih tanggal, dan lihat setiap pesanan khusus yang jatuh tempo hari itu ditambah permintaan khas pelanggan walk-in untuk hari itu dalam seminggu, digabungkan menjadi apa yang harus dipanggang dan berapa banyak persis dari setiap bahan yang Anda butuhkan.

## Bahasa

Toko Roti bukan salah satu templat bisnis layanan Sarang — ini adalah jenis bisnis kategori produk, jadi **tidak** terkunci bahasa. Antarmuka inti, termasuk layar Pesanan Khusus, tersedia dalam 13 bahasa yang didukung.
