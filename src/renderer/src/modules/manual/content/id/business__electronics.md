# Electronics

Memilih **Electronics** sebagai jenis bisnis Anda mengaktifkan **pelacakan nomor serial**, **pelacakan IMEI**, **pelacakan garansi**, dan set modul **Logistik** bersama. Semua yang lain — Billing, Products, Customers, Inventory, Reports — bekerja persis seperti dijelaskan di bab-bab tersebut; bab ini membahas apa yang khusus untuk sebuah toko elektronik.

## Serial / Device Tracking

Buka **Pelacakan Nomor Seri** (berlabel "Device & Serial Tracking" untuk Electronics) dari sidebar untuk mencatat unit stok yang teridentifikasi unik satu per satu — bukan hanya "berapa banyak," tetapi unit persis yang mana. Tambahkan sebuah perangkat satu per satu dengan produk, nomor serial, panjang garansi dalam bulan, tanggal pembelian, dan biayanya, atau gunakan **Impor Massal** untuk menempelkan sekaligus seluruh batch nomor serial (satu per baris, dengan kolom IMEI jika relevan). Setiap perangkat memiliki status — **Tersedia**, **Terjual**, **Dikembalikan**, atau **Rusak** — yang bisa Anda ubah kapan saja dari daftar.

Karena produk yang dilacak-serial mewakili satu unit fisik, menambahkannya ke keranjang di Billing mengunci kuantitasnya menjadi 1 — Anda tidak bisa "menjual 3" dari sebuah nomor serial tertentu, hanya bisa menjual satu unit itu sendiri.

## Pelacakan IMEI

Untuk ponsel dan perangkat lain yang membawa IMEI, setiap catatan perangkat juga bisa membawa dua nomor IMEI (dual-SIM). Kotak **Cari IMEI** khusus pada layar Serial Tracking memungkinkan Anda langsung mencari sebuah perangkat berdasarkan IMEI dan melihat status serta garansinya sekilas — berguna untuk pencarian purnajual atau konter perbaikan.

Jika modul Perbaikan/RMA aktif, layar Serial Tracking juga mendapatkan kotak **Pencarian Layanan** tepat di bawah Cari IMEI — cari atau pindai nomor seri ATAU IMEI dan lihat semua tentang unit tersebut di satu tempat: produk apa itu, kapan dan kepada siapa terjual (dengan faktur dan harga), dan riwayat lengkap tiket perbaikannya. Dirancang tepat untuk momen ketika pelanggan datang dengan perangkat rusak dan tanpa dokumen apa pun — satu pencarian memberi tahu Anda apakah mereka benar-benar membelinya di sini, kapan, dan apa yang sudah dilakukan untuk memperbaikinya. Ask Sarang (jika diaktifkan) juga dapat menjawab pertanyaan langsung seperti "cari nomor seri [nomor]" dengan cara yang sama.

## Pelacakan garansi

Garansi setiap perangkat disimpan sebagai panjang dalam bulan dari tanggal pembelian/mulai-garansinya, dan Sarang menghitung serta menampilkan tanggal kedaluwarsa sebenarnya tepat di sampingnya — ditampilkan sebagai masih berlaku atau jelas ditandai **Kedaluwarsa** setelah lewat. Ask Sarang (jika diaktifkan) juga bisa menjawab "Which items are still under warranty?" langsung dari data ini.

## Tiket Perbaikan / RMA

Sebuah perangkat yang sudah terjual dan dilacak-serial mendapatkan tombol **Perbaikan** pada Serial Tracking — buka untuk melihat riwayat servis lengkap unit tersebut, atau mulai sebuah tiket perbaikan baru untuknya. Sebuah tiket membawa nomor klaim dan bergerak melalui **Received → Diagnosed → Sent to Vendor → Awaiting Parts → Repaired/Replaced → Returned to Customer** (atau Cancelled, hanya sebelum sebuah unit pengganti benar-benar dikirim keluar). Catat vendor mana yang Anda kirimi dan nomor RMA mereka sendiri jika perangkat dikirim untuk perbaikan garansi.

Jika perbaikannya adalah penggantian langsung, pilih **Replaced** dan pilih sebuah unit stok dari produk yang sama sebagai pengganti — Sarang menandai unit asli Defective, unit pengganti Sold (mewarisi faktur penjualan asli), dan menguranginya dari stok secara otomatis, sama seperti penjualan lainnya. Sebuah perbaikan hanya bisa dibuka terhadap unit yang benar-benar sudah terjual — sebuah perangkat berstok yang belum pernah terjual belum memiliki riwayat servis untuk dilacak.

Begitu tiket berpindah ke **Dikirim ke Vendor**, Sarang secara otomatis memulai hitung mundur 30 hari — tanpa langkah tambahan. Jika unit masih berada di vendor melewati jangka waktu itu, unit tersebut ditandai **Terlambat** langsung di daftar Tiket Perbaikan (beserta sudah berapa hari sebenarnya), header layar itu sendiri menampilkan jumlah keterlambatan yang berjalan, dan peringatan Dasbor juga muncul — sehingga unit yang tersangkut di vendor selama lebih dari sebulan tidak akan pernah luput dari perhatian Anda secara diam-diam.

Untuk melihat gambaran lengkap semua RMA yang terbuka, tidak hanya yang terlambat, buka **Laporan → Laporan Usia RMA**: setiap unit yang saat ini berada di vendor, diurutkan dari yang paling lama pergi hingga yang paling baru, dengan grafik yang menunjukkan tepatnya sudah berapa hari masing-masing unit keluar — yang melewati batas 30 hari menonjol dengan warna merah.

Saat tiket perbaikan dikirim untuk perbaikan garansi ke vendor, Anda juga bisa melacak apa yang harus dibayar vendor kembali kepada Anda. Di dalam tampilan detail tiket, klik **Catat Klaim** dan masukkan jumlah yang Anda klaim dari vendor — Sarang menyimpan total berjalan Diklaim / Dipulihkan / Terutang tepat di sana. Saat vendor membayar Anda kembali, baik sekaligus maupun bertahap, catat setiap pembayaran dengan **Catat Pemulihan**; klaim akan tertutup secara otomatis begitu jumlah yang dipulihkan mencapai jumlah yang diklaim. Jika vendor tidak akan pernah membayar (misalnya mereka menolak klaim), gunakan **Hapus Buku** untuk menutupnya tanpa pemulihan. Setiap klaim terbuka dan tertutup di semua tiket dirangkum dalam **Laporan → Buku Besar Pemulihan Vendor**, dengan total terutang di semua vendor dan grafik klaim belum dibayar terbesar Anda.

Anda juga dapat menugaskan teknisi ke tiket perbaikan — saat penerimaan ketika Anda membuatnya, atau kapan saja setelahnya dari tampilan detail tiket. Setelah sebuah tiket memiliki teknisi dan tanggal pengiriman yang selesai, tiket tersebut masuk ke **Laporan → Waktu Perbaikan berdasarkan Teknisi**: waktu perbaikan rata-rata, tercepat, dan terlambat per teknisi, dengan grafik yang mengurutkan mereka dari tercepat ke terlambat. Ini adalah angka kualitas layanan yang nyata — jenis yang memberi tahu Anda siapa yang bisa diandalkan untuk pekerjaan mendesak, dan siapa yang mungkin butuh bantuan.

## Logistics & Supply Chain

Karena template default Electronics mencakup modul Logistics, Anda juga mendapatkan **Armada**, **Kurir**, **Pengiriman**, **Nota Penerimaan Barang**, **Surat Jalan**, **Buku Besar Ongkir**, dan **Analitik Logistik** untuk melacak kendaraan pengiriman Anda sendiri dan pengiriman dari pemasok — lihat layar Logistics di bawah nama-nama tersebut di sidebar.

## Yang dibagikan dengan setiap bisnis

Billing, invoicing, payments, Customers, Products, Reports, Backup, dan Users & Permissions semuanya bekerja persis seperti dijelaskan di bab masing-masing.
