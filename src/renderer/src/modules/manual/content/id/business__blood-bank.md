# Blood Bank

## Apa yang berbeda dari jenis bisnis ini

Sebuah Blood Bank melacak donor, donasi, penyaringan, stok, dan pengeluaran (issue) — sebuah alur kerja yang tidak memiliki padanan nyata di mana pun di Sarang lainnya. Ia dengan sengaja **tidak** menggunakan layar Batch Management generik yang digunakan Pharmacy dan Agricultural Inputs, meskipun setiap unit darah yang bisa digunakan menjadi sebuah catatan batch di bawahnya. Layar generik memiliki jendela "expiring soon" 30-hari yang tetap dan tanpa konsep golongan darah — keduanya salah untuk darah, di mana sebuah unit trombosit hanya bisa digunakan selama sekitar 5 hari dan sebuah unit darah lengkap selama sekitar 35 hari. Jadi Blood Bank mendapatkan layar **Stok Darah** khususnya sendiri dengan aturan kedaluwarsa yang dibuat khusus untuk darah, sambil tetap menggunakan kembali buku besar stok dasar yang sama yang digunakan segala sesuatu yang lain.

## Registri donor

Buka **Pendonor** di sidebar untuk mendaftarkan seorang donor baru — nama, telepon, tanggal lahir, **jenis kelamin**, golongan darah, dan berat badan. Setiap donor mendapatkan kode donor berurutan (misalnya `DNR-202607-0001`). Seorang donor dapat ditandai **deferred** (sementara atau tidak layak selamanya untuk mendonor, dengan sebuah alasan), yang memblokir pencatatan donasi baru dari mereka sampai periode penangguhan benar-benar berlalu. Anda dapat mengirim pengingat recall WhatsApp kepada seorang donor setelah mereka menjadi layak lagi — Sarang memperkirakan tanggal kelayakan berikutnya mereka dari jenis donasi terakhir dan jenis kelamin mereka (90 hari untuk darah lengkap/RBC bagi donor pria, 120 hari untuk donor wanita, 14 hari untuk trombosit, 28 hari untuk plasma) sebagai default konservatif; selalu ikuti pedoman medis/regulasi lokal Anda sendiri untuk jendela kelayakan yang sebenarnya.

Daripada memeriksa setiap donor satu per satu, ketuk **Recall Due** di bagian atas Registri Donor untuk memfilter daftar hanya ke donor yang masa tunggunya sudah berakhir — ini mengubah registri menjadi daftar kerja penjangkauan nyata yang dapat Anda selesaikan, mengirim pengingat panggilan ulang ke masing-masing langsung dari sana.

## Donations & camps

Catat setiap donasi di bawah **Donasi dan Penyaringan** — donor, golongan darah, jenis komponen (Whole Blood, Packed RBC, Platelets, Plasma, atau Cryoprecipitate), dan volume. Anda dapat secara opsional mengorganisir donasi di bawah sebuah kamp donasi (nama, lokasi, tanggal, penyelenggara) untuk kamp yang diadakan jauh dari tempat Anda sendiri.

Jadwalkan dan lacak kegiatan Anda sendiri di bawah **Donation Camps** di bilah sisi — nama, tanggal, lokasi, dan penyelenggara. Setiap donasi yang dicatat di bawah suatu kegiatan dihitung menuju jumlah kehadiran kegiatan itu sendiri, ditampilkan langsung di kartunya, sehingga Anda dapat melihat sekilas kegiatan mana yang benar-benar mendatangkan donor dan mana yang tidak layak diulang.

## Screening

Setiap donasi dimulai dengan penyaringan **Tertunda**. Hanya hasil **Passed** yang membuat stok nyata dan bisa digunakan — pada titik itulah sebuah catatan batch dibuat dengan tanggal kedaluwarsa yang dihitung dari masa simpan sebenarnya jenis komponen tersebut (35 hari untuk Whole Blood, 42 untuk Packed RBC, 5 untuk Platelets, 365 untuk Plasma dan Cryoprecipitate). Hasil **Gagal** tidak pernah masuk stok sama sekali. Gerbang ini disengaja: sebuah unit yang belum disaring atau gagal tidak boleh pernah dikeluarkan.

## Blood Stock

Buka **Stok Darah** untuk melihat setiap unit yang tersedia dikelompokkan berdasarkan golongan darah dan jenis komponen, dengan hari-menuju-kedaluwarsa dan tanda "expiring soon" menggunakan jendela peringatan per-komponen (sesedikit 2 hari untuk trombosit, hingga 30 untuk plasma) alih-alih satu ambang batas generik.

## Waktu Siklus Donasi-ke-Penerbitan

Buka laporan **Donation-to-Issue Cycle Time** untuk melihat seberapa cepat unit yang didonasikan benar-benar digunakan, dipecah berdasarkan jenis komponen. Ini adalah indikator risiko pemborosan yang nyata, bukan hanya snapshot stok — rata-rata waktu siklus 10 hari yang sama biasa saja untuk plasma (masa simpan 365 hari) tetapi tanda peringatan serius untuk trombosit (masa simpan 5 hari), sehingga laporan mengurutkan komponen berdasarkan rata-rata waktu siklusnya sendiri, bukan mencampur semuanya menjadi satu angka.

## Issue — sadar-kompatibilitas

Saat mengeluarkan unit kepada seorang penerima, Sarang memeriksa kompatibilitas ABO/Rh antara golongan darah penerima dan golongan darah donor setiap unit, menggunakan aturan standar untuk darah lengkap / packed RBC (dan aturan terbalik untuk plasma, di mana AB adalah donor universal). **Sebuah unit yang tidak kompatibel diblokir dari pengeluaran** — tombol Issue Units tetap nonaktif sampai Anda memilih unit yang kompatibel, atau, untuk pelepasan darurat yang sungguh-sungguh, mencentang **Override — emergency release** dan mengetik alasan terdokumentasi (keduanya wajib bersamaan; alasan tersebut disimpan pada catatan pengeluaran dan dicatat dalam log). Trombosit dan cryoprecipitate tidak memiliki aturan kompatibilitas keras yang diterapkan, konsisten dengan praktik umum bank darah untuk komponen tersebut. Pemeriksaan ini bukan pengganti prosedur crossmatch nyata laboratorium Anda sendiri. Mengeluarkan sebuah unit secara permanen menandainya terpakai dan mengurangi buku besar stok; membatalkan sebuah pengeluaran yang belum difaktur mengembalikan unit tersebut.

Dalam keadaan darurat, gunakan **Fast Match** di dalam formulir Issue Units alih-alih menggulir seluruh daftar unit sendiri — masukkan golongan darah penerima, jenis komponen yang dibutuhkan, dan berapa unit yang diperlukan, lalu ketuk **Find & Select** untuk langsung memilih setiap unit yang cocok dalam stok, yang paling cepat kedaluwarsa terlebih dahulu, hingga jumlah yang Anda minta. Jika unit yang cocok tersedia lebih sedikit dari yang diminta, Sarang memberi tahu Anda persis berapa kekurangannya sehingga Anda langsung tahu apakah perlu mencari di tempat lain.

## Billing

Buat sebuah faktur dari sebuah pengeluaran darah setelah setiap unit yang dikeluarkan memiliki harga yang ditetapkan dan pengeluaran tersebut tertaut ke seorang pelanggan.

## Bahasa

Blood Bank bukan salah satu template bisnis-layanan Sarang — ini adalah jenis bisnis kategori-produk, sehingga **tidak** dikunci-bahasa. Seluruh antarmuka tersedia dalam ke-13 bahasa yang didukung.
