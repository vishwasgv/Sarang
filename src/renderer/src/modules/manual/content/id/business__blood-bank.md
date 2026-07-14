# Blood Bank

## Apa yang berbeda dari jenis bisnis ini

Sebuah Blood Bank melacak donor, donasi, penyaringan, stok, dan pengeluaran (issue) — sebuah alur kerja yang tidak memiliki padanan nyata di mana pun di Sarang lainnya. Ia dengan sengaja **tidak** menggunakan layar Batch Management generik yang digunakan Pharmacy dan Agricultural Inputs, meskipun setiap unit darah yang bisa digunakan menjadi sebuah catatan batch di bawahnya. Layar generik memiliki jendela "expiring soon" 30-hari yang tetap dan tanpa konsep golongan darah — keduanya salah untuk darah, di mana sebuah unit trombosit hanya bisa digunakan selama sekitar 5 hari dan sebuah unit darah lengkap selama sekitar 35 hari. Jadi Blood Bank mendapatkan layar **Blood Stock** khususnya sendiri dengan aturan kedaluwarsa yang dibuat khusus untuk darah, sambil tetap menggunakan kembali buku besar stok dasar yang sama yang digunakan segala sesuatu yang lain.

## Registri donor

Buka **Donors** di sidebar untuk mendaftarkan seorang donor baru — nama, telepon, tanggal lahir, jenis kelamin, golongan darah, dan berat badan. Setiap donor mendapatkan kode donor berurutan (misalnya `DNR-202607-0001`). Seorang donor dapat ditandai **deferred** (sementara atau tidak layak selamanya untuk mendonor, dengan sebuah alasan), yang memblokir pencatatan donasi baru dari mereka sampai periode penangguhan benar-benar berlalu. Anda dapat mengirim pengingat recall WhatsApp kepada seorang donor setelah mereka menjadi layak lagi — Sarang memperkirakan interval pemulihan 90-hari setelah sebuah donasi darah-lengkap sebagai default konservatif; selalu ikuti pedoman medis/regulasi lokal Anda sendiri untuk jendela kelayakan yang sebenarnya.

## Donations & camps

Catat setiap donasi di bawah **Donations & Screening** — donor, golongan darah, jenis komponen (Whole Blood, Packed RBC, Platelets, Plasma, atau Cryoprecipitate), dan volume. Anda dapat secara opsional mengorganisir donasi di bawah sebuah kamp donasi (nama, lokasi, tanggal, penyelenggara) untuk kamp yang diadakan jauh dari tempat Anda sendiri.

## Screening

Setiap donasi dimulai dengan penyaringan **Pending**. Hanya hasil **Passed** yang membuat stok nyata dan bisa digunakan — pada titik itulah sebuah catatan batch dibuat dengan tanggal kedaluwarsa yang dihitung dari masa simpan sebenarnya jenis komponen tersebut (35 hari untuk Whole Blood, 42 untuk Packed RBC, 5 untuk Platelets, 365 untuk Plasma dan Cryoprecipitate). Hasil **Failed** tidak pernah masuk stok sama sekali. Gerbang ini disengaja: sebuah unit yang belum disaring atau gagal tidak boleh pernah dikeluarkan.

## Blood Stock

Buka **Blood Stock** untuk melihat setiap unit yang tersedia dikelompokkan berdasarkan golongan darah dan jenis komponen, dengan hari-menuju-kedaluwarsa dan tanda "expiring soon" menggunakan jendela peringatan per-komponen (sesedikit 2 hari untuk trombosit, hingga 30 untuk plasma) alih-alih satu ambang batas generik.

## Issue — sadar-kompatibilitas

Saat mengeluarkan unit kepada seorang penerima, Sarang memeriksa kompatibilitas ABO/Rh antara golongan darah penerima dan golongan darah donor setiap unit, menggunakan aturan standar untuk darah lengkap / packed RBC (dan aturan terbalik untuk plasma, di mana AB adalah donor universal). Ini adalah pemeriksaan keamanan penasihat yang ditampilkan pada titik pemilihan — ini bukan pengganti prosedur crossmatch nyata laboratorium Anda sendiri. Trombosit dan cryoprecipitate tidak memiliki aturan kompatibilitas keras yang diterapkan, konsisten dengan praktik umum bank darah untuk komponen tersebut. Mengeluarkan sebuah unit secara permanen menandainya terpakai dan mengurangi buku besar stok; membatalkan sebuah pengeluaran yang belum difaktur mengembalikan unit tersebut.

## Billing

Buat sebuah faktur dari sebuah pengeluaran darah setelah setiap unit yang dikeluarkan memiliki harga yang ditetapkan dan pengeluaran tersebut tertaut ke seorang pelanggan.

## Bahasa

Blood Bank bukan salah satu template bisnis-layanan Sarang — ini adalah jenis bisnis kategori-produk, sehingga **tidak** dikunci-bahasa. Seluruh antarmuka tersedia dalam ke-13 bahasa yang didukung.
