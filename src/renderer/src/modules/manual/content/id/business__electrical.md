# Listrik

## Apa yang berbeda pada jenis usaha ini

Toko listrik menjual campuran barang yang dihitung per potong (saklar, MCB, fitting) dan kabel yang dipotong sesuai panjang dari gulungan — gulungan yang sama adalah satu item stok, tetapi setiap penjualan memiliki panjang berbeda. Listrik juga mengaktifkan pelacakan serial dan garansi (untuk switchgear dan unit lain yang dapat diidentifikasi secara individual), akun berjalan lokasi kerja untuk kontraktor, dan pelacakan varian (untuk ukuran kabel, ukuran fitting, dan spesifikasi lain yang dijual dengan satu nama produk).

## Penagihan kabel berdasarkan meter

Saat membuat atau mengedit produk, aktifkan **Jual berdasarkan Panjang** dan pilih satuan (meter atau kaki) serta harga per satuan. Saat penagihan, menambahkan produk itu ke keranjang menambahkannya dengan kuantitas satu satuan panjang, bukan satu potong, dengan input kuantitas berbutir halus (langkah 0,1) sehingga kasir dapat memasukkan persis berapa yang dipotong dari gulungan — 4,5 meter, bukan "5 potong."

## Akun Lokasi Kerja

Buka **Job-Site Accounts** di bilah sisi untuk membuka akun berjalan untuk kontraktor yang bekerja di lokasi tertentu — berguna saat tukang listrik yang sama membeli material untuk satu pekerjaan dalam beberapa kunjungan dan Anda ingin melacak apa yang menjadi utang pekerjaan itu sebagai catatannya sendiri, terpisah dari buku besar pelanggan umum kontraktor. Buat akun dengan nama (mis. "Kediaman Sharma — Sayap B"), kontraktor yang ditagih, dan alamat lokasi opsional.

Saat menagih penjualan KREDIT ke kontraktor tersebut, pemilih **Job-Site Account** muncul — pilih akun untuk menandai faktur ke sana. Buka akun dari daftar untuk melihat setiap faktur yang ditandai ke sana dan total yang ditagih dan belum lunas berjalan. Akun hanya dapat ditutup setelah saldo terutangnya lunas sepenuhnya.

## Pembuat Kit Pekerjaan

Saat mengedit produk dan menandainya sebagai kit (lihat bab Inventaris untuk cara kerja kit secara umum), produk Listrik mendapatkan tombol tambahan **Suggest from past orders** di editor komponen kit. Ini melihat riwayat faktur nyata untuk apa yang sebenarnya pernah dibeli bersama produk ini sebelumnya — kipas langit-langit dijual bersama kabel, saklar, dan kotak sambungan, misalnya — dan mengisi otomatis daftar komponen dengan pendamping paling sering dan kuantitas khasnya. Tinjau, sesuaikan, atau hapus baris yang disarankan sebelum menyimpan; tidak ada yang ditambahkan ke kit sampai Anda menyimpan.

## Laporan

Selain laporan standar Penjualan, Inventaris, dan Keuangan, Listrik mendapatkan:

- **Pemborosan & Hasil Gulungan** — untuk setiap produk yang dijual berdasarkan panjang, berapa yang diterima (dari catatan pembelian), berapa yang benar-benar terjual berdasarkan panjang, dan berapa yang dicatat sebagai penghapusan/penyesuaian stok. Persentase hasil dan perkiraan pemborosan memudahkan menemukan gulungan yang kehilangan lebih banyak material pada potongan sisa dari yang diharapkan.
- **Barang Cepat Laku berdasarkan Spesifikasi** — matriks kecepatan-versus-margin barang cepat/lambat laku yang sama yang digunakan toko Perkakas, dibaca untuk Listrik: di bawah pelacakan varian, nama dan SKU produk sudah membawa spesifikasinya (ukuran kabel, ukuran fitting), jadi ini meranking spesifikasi mana yang benar-benar cepat laku dan mana yang diam.
- **Register Keamanan ISI/BIS** — register keterlacakan setiap unit yang dilacak serial: produk apa, nomor serial/batch-nya, kapan diterima, garansinya, dan kapan serta ke faktur mana dijual — catatan yang Anda perlukan siap saji untuk pemeriksaan kepatuhan keamanan atau penarikan produk.

## Bahasa

Listrik bukan salah satu templat bisnis layanan Sarang — ini adalah jenis bisnis kategori produk, jadi **tidak** terkunci bahasa. Antarmuka inti tersedia dalam 13 bahasa yang didukung.
