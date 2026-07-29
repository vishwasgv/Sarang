# Laboratorium Diagnostik & Patologi

## Apa yang berbeda dari jenis bisnis ini

Sebuah Diagnostic & Pathology Lab berjalan di atas fondasi appointment/service-catalog yang sama yang dibagikan setiap bisnis layanan di Sarang, plus satu bundel layar khusus-lab: **Lab Test Orders**. Sebuah katalog tes/panel menggunakan kembali Service Catalog standar alih-alih daftar paralel terpisah — sebuah tes darah atau X-ray hanyalah sebuah layanan yang Anda jual, diberi harga dan dikenai pajak dengan cara yang sama seperti layanan lainnya. Yang sungguh berbeda adalah siklus hidup order di bawahnya — sebuah order lab bergerak melalui pengumpulan sampel, entri hasil per tes, dan sebuah laporan terkunci dan final, sebelum pernah difaktur atau diserahkan ke pasien.

## Membuat sebuah order lab

Buka **Lab Test Orders** di sidebar. Sebuah order baru membutuhkan nama pasien (catatan pelanggan tertaut bersifat opsional — pasien walk-in tidak masalah) dan setidaknya satu tes atau panel yang dipilih dari Service Catalog Anda. Anda dapat secara opsional mencatat usia pasien dan menautkan order ke sebuah appointment yang ada. Setiap order mendapat nomor order berurutan (misalnya `LAB-202607-0001`, direset per bulan kalender).

## Rujukan dari sebuah klinik

Jika seorang dokter di tempat lain merujuk pasien ini ke lab Anda, catat siapa yang merujuk mereka (`referredByProviderId`) beserta catatan rujukan apa pun. Ini adalah alur kerja yang sungguh nyata dan sehari-hari untuk sebuah lab mandiri yang menerima rujukan dari klinik dokter umum, klinik spesialis, dan rumah sakit yang bukan bagiannya.

## Pengumpulan sampel

Setelah sebuah sampel diambil (darah, urin, tinja, swab, pencitraan, atau jenis lain), tandai order **Sample Collected**. Ini mencatat siapa yang mengumpulkannya dan kapan, dan memindahkan setiap item tes tertunda pada order ke status Collected. Tes hanya dapat ditambahkan ke atau dihapus dari sebuah order sebelum langkah ini — setelah sebuah sampel dikumpulkan, daftar tes terkunci.

## Entri hasil

Untuk setiap tes pada order, masukkan hasilnya: sebuah set parameter bernama (nilai, unit, rentang referensi, dan flag Low / Normal / High / Abnormal — atau **Critical**, ketika sebuah nilai jatuh ke dalam rentang nilai panik yang diatur untuk tes tersebut). Memasukkan hasil pertama pada sebuah order secara otomatis memindahkannya dari Sample Collected ke In Process, sehingga staf front-desk dapat melihat sekilas bahwa pekerjaan benar-benar telah dimulai tanpa menunggu setiap tes selesai.

Sebuah hasil **Critical** menempatkan lencana merah pada order (dan pada item spesifik) segera, dan order tidak dapat dianggap tertangani sampai Anda menggunakan **Record Doctor Notified** untuk mencatat bahwa Anda benar-benar menelepon dokter yang merujuk, dengan sebuah catatan — ini adalah catatan sungguhan bahwa eskalasi terjadi, bukan sekadar bahwa angka tersebut ditandai.

## Menyelesaikan laporan

Setelah setiap tes pada order memiliki hasil yang dimasukkan, **Finalize Report** mengunci seluruh order — statusnya menjadi Reported dan setiap item ditandai Reported. Hasil laporan yang sudah final tidak dapat lagi diedit; jika koreksi sungguhan diperlukan, itu harus terjadi sebelum finalisasi. Setelah laporan difinalisasi, tandai **Delivered** setelah pasien atau klinik perujuk benar-benar menerimanya. Lampirkan file scan/gambar sebenarnya ke sebuah order dari tampilan detailnya.

## Billing

Hasilkan sebuah faktur langsung dari sebuah order lab setelah setiap tes memiliki harga lebih besar dari nol dan order tertaut ke sebuah catatan pelanggan. Setiap tes muncul sebagai item barisnya sendiri pada faktur, menggunakan tarif pajak yang sama (kode SAC, jika ditetapkan) seperti entrinya di Service Catalog.

## Reports

Layar **Reports** mencakup sebuah laporan Lab Turnaround khusus untuk vertikal ini, menunjukkan order berdasarkan tahap (ordered, sample collected, in process, reported) dan waktu turnaround dari order ke laporan untuk masing-masing — berguna untuk mengetahui di mana sampel menumpuk.

## Bahasa

Diagnostic & Pathology Lab adalah salah satu template bisnis-layanan Sarang, dan — tidak seperti Tailor/Boutique, pengecualian bernama satu-satunya — ia mempertahankan aturan standar untuk kelompok itu: antarmuka terkunci pada **hanya bahasa Inggris**, terlepas dari bahasa mana yang telah Anda tetapkan di tempat lain di Sarang.
