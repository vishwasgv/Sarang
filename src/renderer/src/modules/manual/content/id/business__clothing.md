# Clothing

Memilih **Clothing** sebagai jenis bisnis Anda mengaktifkan **pelacakan varian ukuran/warna**, **Retur**, dan set modul **Logistik** bersama. Semua yang lain — Billing, Products, Customers, Inventory, Reports — bekerja persis seperti dijelaskan di bab-bab tersebut; bab ini membahas apa yang khusus untuk sebuah toko pakaian.

## Pelacakan varian (ukuran & warna)

Sebuah item pakaian biasanya bukan satu nomor stok tunggal — "Kaos Pria" mungkin ada dalam lima ukuran dan empat warna, masing-masing dengan hitungan stoknya sendiri. Dari **Produk**, ketuk ikon lapisan pada produk mana pun untuk membuka **Kelola Varian**. Tambahkan satu baris per kombinasi ukuran/warna yang benar-benar Anda stok (kolom ukuran dan warna menyarankan ukuran pakaian umum saat Anda mengetik — XS hingga 3XL — tetapi Anda bisa mengetik apa saja), masing-masing dengan SKU opsionalnya sendiri, tambahan harga di atas harga produk dasar jika varian itu lebih mahal (misalnya ukuran plus), dan kuantitas stoknya sendiri. Layar menampilkan total berjalan dari varian dan stok gabungan di semuanya.

Catatan produk untuk bisnis Clothing juga mendapatkan kolom opsional **Jenis Kelamin** (Men's/Women's/Unisex) dan kolom teks bebas **Musim / Koleksi** (mis. "Summer 2026", "Koleksi Diwali") untuk membantu Anda mengorganisir katalog.

Menyetok banyak kombinasi sekaligus? Gunakan **Generate Size × Colour Matrix** di bagian bawah Manage Variants — ketik ukuran dan warna Anda sebagai daftar dipisah koma (mis. "S, M, L" dan "Black, White") dan Sarang membuat setiap kombinasi sebagai baris baru sekaligus, melewati pasangan mana pun yang sudah Anda tambahkan secara manual.

Setiap baris varian memiliki **barcode** sendiri — buat satu per baris, atau gunakan **Generate Missing Barcodes** untuk mengisi setiap varian yang belum memilikinya. Saat mencetak label, produk yang dilacak-varian membuka sebuah picker sehingga label membawa barcode dan harga varian yang tepat itu sendiri, bukan milik produk induknya.

Siap memesan ulang produk tetapi tidak yakin cara membaginya berdasarkan ukuran? Buka **Pembagian Pemesanan Ulang yang Disarankan** di bagian bawah Kelola Varian, masukkan jumlah total (atau biarkan kosong untuk menggunakan jumlah pemesanan ulang yang sudah dikonfigurasi produk itu sendiri), dan Sarang memberi bobot pembagian ke arah ukuran dan warna yang benar-benar terjual dalam 90 hari terakhir — alih-alih membagi rata. Ini adalah solusi untuk masalah klasik "kehabisan M dan L tiga minggu sebelum S dan XL, tapi tetap dipesan ulang secara merata." Ini hanya saran, bukan pesanan langsung — Anda tetap membuat Pesanan Pembelian sesungguhnya sendiri, dengan informasi dari pembagian ini.

## Menjual sebuah varian

Di **Penagihan**, menambahkan produk yang memiliki varian yang dikonfigurasi tidak langsung menambahkannya ke keranjang — ini membuka picker sehingga Anda memilih kombinasi ukuran/warna yang tepat yang dijual, dan stok serta harga varian spesifik itu (harga dasar + tambahan harganya, jika ada) yang benar-benar masuk ke keranjang. Ini menjaga hitungan stok per-ukuran/warna Anda akurat alih-alih hanya mengurangi satu angka bersama untuk seluruh produk.

## Laporan Tingkat Penjualan per Musim/Koleksi

Jika Anda memberi tag produk Anda dengan **Musim / Koleksi**, buka **Laporan → Tingkat Penjualan per Musim/Koleksi** untuk melihat, bulan demi bulan, berapa bagian dari unit terjual-plus-stok setiap koleksi yang benar-benar terjual — cara cepat untuk melihat koleksi mana yang bergerak dan mana yang diam-diam menumpuk di rak. Grafik menampilkan setiap koleksi sebagai batangnya sendiri per bulan, dengan garis tren rata-rata keseluruhan yang menumpang di atasnya; angka tersebut dibandingkan dengan stok Anda saat ini untuk setiap bulan yang ditampilkan, jadi bacalah sebagai tren yang berjalan, bukan snapshot historis pasti setiap bulan. Produk tanpa musim yang diatur sepenuhnya dikecualikan dari laporan ini — beri tag pada yang ingin Anda lacak.

## Laporan Peta Panas Ukuran × Gaya

Buka **Laporan → Peta Panas Ukuran × Gaya** untuk melihat kisi yang menunjukkan dengan tepat kombinasi ukuran/produk ("gaya") mana yang benar-benar terjual — setiap produk di samping, setiap ukuran di atas, setiap sel diberi warna sesuai jumlah unit dari kombinasi persis itu yang terjual dalam rentang tanggal yang Anda pilih. Sel yang lebih gelap berarti lebih banyak unit terjual; sel kosong berarti pasangan ukuran/gaya itu tidak terjual sama sekali. Ini dirancang untuk menemukan pola yang akan terkubur dalam daftar penjualan biasa — gaya yang hanya terjual di M dan L, atau ukuran yang tidak pernah terjual apa pun gayanya. Kisi ini menampilkan 15 gaya terlaris teratas berdasarkan volume, agar tetap mudah dibaca bahkan pada katalog besar.

## Laporan Margin berdasarkan Merek/Vendor

Tetapkan **Vendor/Pemasok** ke produk Anda (layar Produk — bidang yang sama yang digunakan untuk pembelian) dan buka **Laporan → Margin berdasarkan Merek/Vendor** untuk melihat pendapatan, biaya, dan margin yang dipecah berdasarkan pemasok asal setiap produk yang terjual. Ini menjawab pertanyaan yang berbeda dari tampilan nilai-stok-per-produk milik Laporan Inventaris sendiri — ini tentang merek/vendor mana yang benar-benar menguntungkan untuk dipertahankan, bukan hanya mana yang paling laris. Vendor yang marginnya negatif ditampilkan secara jujur sebagai kerugian, tidak disembunyikan atau dibatasi ke nol — itulah tepatnya kasus yang perlu ditangkap. Produk tanpa vendor/pemasok yang ditetapkan sepenuhnya dikecualikan dari laporan ini — tetapkan yang ingin Anda lacak.

## Returns

Clothing juga mendapatkan layar **Retur** standar — cari faktur lampau berdasarkan nomor, pilih item dan kuantitas mana yang akan diretur (dibatasi pada apa yang benar-benar masih bisa diretur, memperhitungkan apa pun yang sudah diretur sebelumnya), berikan alasan, dan kirim. Lihat bagian *Returns* dari bab Retail untuk perilaku lengkapnya — bekerja identik di sini.

Untuk baris yang terlacak variannya (produk apa pun yang dijual dengan ukuran/warna), layar Retur juga menyediakan tombol **Tukar** di samping pengatur kuantitas retur — untuk saat pelanggan menginginkan ukuran atau warna berbeda, bukan pengembalian dana. Pilih kuantitas, pilih ukuran/warna pengganti dari yang saat ini tersedia di stok, berikan alasan, dan konfirmasi. Di baliknya, ini membuat dua transaksi yang tertaut dan sepenuhnya nyata dalam satu langkah: faktur retur untuk barang yang diserahkan (mengembalikannya ke stok dan mengkredit pelanggan persis seperti retur biasa) dan faktur penjualan baru untuk barang pengganti, dengan harga saat ini milik barang pengganti itu sendiri — bukan harga barang lama, sehingga perubahan harga tercermin secara jujur. Sarang langsung menampilkan selisih pastinya: jika barang pengganti lebih mahal, berapa tambahan yang harus ditagih; jika lebih murah, berapa yang harus dikembalikan; dan jika harganya persis sama, tidak ada saldo yang harus dibayar.

## Logistics & Supply Chain

Karena template default Clothing mencakup modul Logistics, Anda juga mendapatkan **Armada**, **Kurir**, **Pengiriman**, **Nota Penerimaan Barang**, **Surat Jalan**, **Buku Besar Ongkir**, dan **Analitik Logistik** untuk melacak kendaraan pengiriman Anda sendiri dan pengiriman dari pemasok — lihat layar Logistics di bawah nama-nama tersebut di sidebar.

## Yang dibagikan dengan setiap bisnis

Billing, invoicing, payments, Customers, Products, Reports, Backup, dan Users & Permissions semuanya bekerja persis seperti dijelaskan di bab masing-masing.
