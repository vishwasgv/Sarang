# Agricultural Inputs & Equipment

## Apa yang berbeda dari jenis bisnis ini

Agricultural Inputs & Equipment mencakup toko yang menjual baik input pertanian yang habis pakai (pupuk, pestisida, benih) maupun peralatan pertanian tahan lama (traktor, sprayer, pompa) berdampingan. Alih-alih menciptakan layar baru untuk ini, Sarang memberinya persis pelacakan yang benar-benar dibutuhkan masing-masing separuh bisnis, dipinjam dari dua vertikal yang sudah menyelesaikan masing-masing separuh dengan benar: pelacakan batch dan kedaluwarsa (bentuk yang sama, kritis-keselamatan, yang digunakan Pharmacy untuk obat-obatan) untuk barang habis pakai, dan pelacakan nomor serial serta garansi (bentuk yang sama yang digunakan Electronics untuk ponsel) untuk peralatan — minus IMEI, yang spesifik-ponsel dan tidak memiliki padanan pada traktor atau sprayer.

## Pupuk & Pestisida — pelacakan batch dan kedaluwarsa

Setiap produk pupuk, pestisida, atau benih yang Anda stok sebagai sebuah batch mendapatkan nomor batch, tanggal produksi, dan tanggal kedaluwarsa, persis seperti apotek menstok obat. Buka **Batch Tracking** di sidebar untuk mencatat batch yang masuk dan melihat apa yang mendekati kedaluwarsa. Ini penting karena alasan yang sama pentingnya di apotek: agrokimia benar-benar terdegradasi dan bisa menjadi tidak aman atau tidak efektif setelah tanggal kedaluwarsanya, dan seorang pemilik toko perlu bisa menjawab "stok mana yang paling cepat kedaluwarsa" sekilas alih-alih menebak dari ingatan.

## Peralatan Pertanian — nomor serial dan garansi

Traktor, sprayer bertenaga, pompa air, dan peralatan tahan lama lainnya dilacak satu per satu berdasarkan nomor serial alih-alih sebagai kuantitas yang tidak dibedakan, dengan periode garansi tercatat untuk setiap unit. Buka **Pelacakan Nomor Seri** di sidebar untuk ini. Berbeda dengan Electronics (yang juga melacak IMEI untuk ponsel), Agricultural Inputs dengan sengaja tidak mengaktifkan pelacakan IMEI — itu adalah pengidentifikasi khusus-ponsel yang tidak memiliki arti untuk traktor atau sprayer, sehingga kolom itu cukup tidak berlaku di sini.

## Servis Peralatan — Job Cards

Ketika seorang pelanggan membawa sepotong peralatan untuk perbaikan atau servis terjadwal, buka sebuah job card dari **Kartu Kerja** di sidebar — alur kerja job-card generik yang sama yang digunakan jenis bisnis Repair Sarang. Catat apa yang dibawa, pekerjaan yang harus dilakukan, suku cadang yang digunakan, dan biaya tenaga kerja, dan job card tersebut dapat ditagih setelah pekerjaan selesai.

## Persyaratan kredit terkait musim panen

Seorang pelanggan petani sering perlu membayar setelah panen, bukan pada saat pembelian. Saat menagih penjualan Kredit, atur **due date** yang sebenarnya — Sarang menampilkan lencana jatuh tempo pada faktur begitu tanggal tersebut terlewati (bukan tanggal penjualan), dan laporan aging Outstanding Analytics juga mengelompokkannya berdasarkan due date sebenarnya, sehingga pembayaran yang ditunda hingga panen tidak ditandai sebagai jatuh tempo hanya karena waktu telah berlalu sejak penjualan.

Mengetik tanggal tetap hanyalah sebuah tebakan — persyaratan kredit petani yang sebenarnya mengikuti kalender panen, bukan hitungan hari yang tetap. Pada penjualan Kredit, alih-alih (atau selain) tanggal jatuh tempo manual, Anda dapat menautkan faktur ke **Musim Panen (Crop Season)** — peristiwa panen nyata yang Anda tentukan sekali (misalnya "Panen Gandum" pada 15 April) dan gunakan kembali di setiap penjualan kredit untuk tanaman itu. Pilih dari menu drop-down yang muncul di bawah kolom tanggal jatuh tempo, atau tambahkan yang baru di sana melalui **Manage Seasons**. Sarang menghitung tanggal jatuh tempo faktur yang sebenarnya dari kejadian panen berikutnya musim tersebut — tahun ini jika belum lewat, atau tahun depan jika sudah — sehingga tanggal jatuh tempo selalu terkait dengan peristiwa pertanian nyata, bukan hitungan hari yang sewenang-wenang.

## Saran Produk Terkait Tanaman

Jika Anda menandai produk dengan tanaman yang dituju melalui kolom Recommended Crop pada catatan produknya (misalnya "Gandum", "Kapas", "Padi" — nama apa pun yang digunakan di wilayah Anda sendiri, bukan daftar tetap), produk tersebut menjadi dapat dijelajahi berdasarkan tanaman di titik penjualan. Di Billing, deretan chip **Browse by Crop** muncul di atas pencarian produk begitu ada produk yang ditandai — ketuk tanaman untuk melihat setiap pupuk, pestisida, atau benih yang direkomendasikan untuknya, lengkap dengan stok dan harga langsung, dan tambahkan langsung ke keranjang. Ini mengubah "pupuk mana yang cocok untuk tanaman ini?" dari sesuatu yang harus diingat kasir menjadi sesuatu yang bisa dicari dalam dua ketukan.

## Peringatan kedaluwarsa khusus-kategori

Kategori input-agri yang berbeda membutuhkan peringatan dini yang berbeda pula — benih dan pupuk sering membutuhkan ancang-ancang lebih panjang daripada barang yang cepat laku. Atur **expiry alert lead time** (dalam hari) per produk untuk menggantikan jendela peringatan standar 30 hari; batch dari produk tersebut kemudian menampilkan lencana peringatannya berdasarkan lead time yang dikonfigurasi sendiri.

## Dasbor Gabungan

Buka **Agri Dashboard** untuk tampilan satu layar di kedua separuh bisnis sekaligus — barang habis pakai berstok rendah, batch yang mendekati/sudah kedaluwarsa, jumlah total peralatan, dan peralatan dengan garansi yang segera berakhir — alih-alih memeriksa dua layar terpisah.

Dasbor yang sama juga melacak **tanggal servis peralatan yang jatuh tempo** — servis terjadwal berikutnya untuk traktor atau sprayer, terpisah dari kedaluwarsa garansinya. Atur tanggal servis untuk peralatan mana pun yang tercatat langsung dari panel Equipment Service Due di dasbor, dan Sarang akan menandainya di sana begitu segera jatuh tempo atau terlambat. Ketuk **Remind** pada unit yang ditandai untuk mengirim pengingat WhatsApp ke pelanggan berisi tanggal jatuh tempo.

## Laporan Eksposur Kredit Musiman & Pembayaran Petani

Dua laporan di layar Reports khusus untuk jenis bisnis ini. **Eksposur Kredit Musiman (Seasonal Credit Exposure)** menampilkan setiap faktur kredit yang saat ini tertunggak dikelompokkan berdasarkan bulan jatuh tempo sepanjang tahun kalender, ditambah rincian terpisah berdasarkan Musim Panen yang tertaut — sehingga Anda dapat melihat sekilas kapan eksposur kredit Anda mencapai puncaknya sepanjang tahun, yang bagi sebagian besar toko input pertanian terpusat di sekitar bulan-bulan panen. **Riwayat Pembelian & Pembayaran per Petani (Farmer-Wise Purchase & Repayment History)** memberi peringkat setiap pelanggan kredit berdasarkan seberapa andal mereka benar-benar membayar kembali, akun paling berisiko didahulukan — berbeda dari Customer Ledger pelanggan tunggal, ini adalah perbandingan antar-petani yang memberi tahu Anda kepada siapa memberikan kredit mudah musim depan dan dari siapa menagih terlebih dahulu.

## Logistics & Supply Chain

Karena peritel input-agri secara rutin menerima pengiriman formal dari pemasok (karung pupuk dan peralatan yang tiba dengan truk), set modul Logistics & Supply Chain penuh diaktifkan secara default — Fleet, Carriers, Shipments, GRN (penerimaan barang), Delivery Challan, Freight Ledger, dan Logistics Analytics semuanya muncul di sidebar tanpa perlu diaktifkan secara terpisah.

## Semua yang lain

Billing, Customers & Suppliers, Reports, Backup, dan Users & Permissions semuanya bekerja persis seperti dijelaskan di bab masing-masing — tidak ada yang berubah tentang jenis bisnis ini mengenai cara Anda membuat faktur penjualan atau menerima pembayaran.

## Bahasa

Agricultural Inputs & Equipment bukan salah satu vertikal layanan-profesional Sarang, sehingga tidak dikunci-bahasa — seluruh antarmuka tersedia dalam ke-13 bahasa yang didukung Sarang, sama seperti Retail, Pharmacy, atau jenis bisnis produk-kategori lainnya.
