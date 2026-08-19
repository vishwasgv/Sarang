# Klinik Hewan

Layar jenis bisnis ini hanya dalam bahasa Inggris, terlepas dari pengaturan bahasa Anda di tempat lain di Sarang.

## Fondasi layanan bersama

Setiap jenis bisnis berbasis layanan di Sarang — termasuk Klinik Hewan — dimulai dari empat blok bangunan yang sama: **Janji Temu** (memesan dan menjadwalkan kunjungan), sebuah **Katalog Layanan** (daftar konsultasi, prosedur, dan harganya), **Provider Schedules** (dokter hewan mana yang tersedia kapan), dan sebuah **Notification Queue** otomatis yang menangani pengingat (seperti pengingat vaksinasi di bawah) tanpa Anda harus mengirimnya secara manual. Sisa bab ini membahas apa yang spesifik untuk klinik hewan.

## Patients

Buka **Patients** dari sidebar untuk melihat setiap hewan yang terdaftar di klinik Anda, bukan pemilik manusianya. Setiap kartu pasien menampilkan spesies (dengan penanda emoji untuk Anjing/Kucing/Burung/Kelinci/Reptil/Lainnya), ras, jenis kelamin, berat, dan lencana status vaksinasi (Up to Date / Due Soon / Overdue / No Records). Filter berdasarkan spesies, cari berdasarkan nama pasien atau pemilik, atau beralih ke tampilan **Diarsipkan** untuk pasien yang tidak lagi aktif.

Klik **Add Patient** untuk mendaftarkan yang baru — nama, spesies, ras, tanggal lahir, jenis kelamin, warna/tanda, ID microchip, pemilik terkait opsional (dicari dari Customers yang sudah ada, atau dibiarkan sebagai walk-in), dan catatan teks bebas untuk alergi atau kondisi kronis.

Sebuah banner di bagian atas daftar Patients menampilkan **Upcoming Vaccinations** yang jatuh tempo dalam 30 hari ke depan di semua pasien, sehingga tidak ada yang terlewat.

Jika Anda menyimpan daftar **Breed Health Alerts** (layar tersendiri di sidebar), peringatan yang cocok muncul secara otomatis saat Anda mengetik ras di formulir Add Patient — dan tetap terlihat di profil pasien tersebut setelahnya, setiap kali dibuka, tidak hanya saat pendaftaran. Daftar ini sepenuhnya milik Anda untuk dibangun: Sarang tidak menyertakan saran dokter hewan yang sudah ditulis sebelumnya, jadi tambahkan catatan risiko apa pun yang ingin Anda ingatkan kepada tim Anda sendiri untuk ras yang benar-benar Anda tangani (mis. "tanyakan gejala pinggul/sendi di setiap kunjungan").

## Profil pasien

Membuka seorang pasien membawa Anda ke tiga tab:

- **Overview** — detail pasien, kartu pemilik terkait, dan sebuah log **Weight History**. Tambahkan penimbangan baru kapan saja; setelah ada dua entri atau lebih, sebuah grafik tren kecil memplot berat dari waktu ke waktu. Jika pemilik memiliki hewan peliharaan aktif lain yang terdaftar, sebuah kartu **Other Pets in This Household** mencantumkannya — satu klik membawa Anda langsung ke profil saudara tersebut, tanpa perlu mencari lagi di daftar Patients.
- **Vaccinations** — setiap catatan vaksinasi (nama vaksin, jenis, nomor batch, produsen, tanggal pemberian, tanggal jatuh tempo berikutnya, dokter hewan yang memberikan). Setiap catatan menampilkan lencana status (Overdue / Due in Xd / Up to date). Dari sini Anda dapat **mengantrekan pengingat WhatsApp** untuk tanggal jatuh tempo mendatang (dilewati otomatis jika pemilik tidak memiliki nomor telepon tercatat), atau **mencetak sertifikat vaksinasi**.
- **Janji Temu** — riwayat kunjungan lengkap pasien dengan status (Scheduled, Confirmed, In Progress, Completed, Cancelled, No-show).

Mengedit seorang pasien juga memungkinkan Anda **mengarsipkannya** (menyembunyikannya dari daftar aktif tanpa menghapus riwayatnya) dan memulihkannya nanti.

## Sertifikat vaksinasi

Mencetak sertifikat vaksinasi menghasilkan dokumen formal satu halaman dengan kop surat klinik, detail pasien dan vaksin, dan sebuah disclaimer bahwa ini adalah dokumen kenyamanan yang dihasilkan oleh Sarang, bukan catatan kedokteran hewan yang tervalidasi — selalu verifikasi detail sebelum mengandalkannya secara klinis.

## Catatan konsultasi

Saat memesan janji temu, pilih **patient (pet)** spesifik yang dimaksud. Setelah kunjungan terjadi, buka **Catatan Klinis** untuk mencatat konsultasi sungguhan — tanda vital, temuan, dan rencana — pencatatan terstruktur yang sama yang dibagikan setiap vertikal klinis di Sarang. Catatan tersebut sudah terisi sebelumnya dengan nama dan usia hewan peliharaan itu sendiri (bukan pemiliknya), dan menampilkan spesies, ras, jenis kelamin, dan pemilik hewan tersebut tepat di sampingnya untuk konteks cepat.

Tanda vital diperiksa terhadap **normal ranges** yang memperhitungkan spesies pasien — kisaran suhu dan denyut nadi normal seekor anjing sungguh-sungguh berbeda dari kucing atau manusia, dan Sarang mengevaluasi setiap pembacaan secara otomatis terhadap kisaran yang tepat.

## Laporan

Buka **Reports → Vaccination Compliance** untuk melihat berapa banyak dosis lanjutan yang benar-benar datang tepat waktu. Ini melihat setiap dosis yang diberikan dalam rentang tanggal pilihan Anda yang memiliki tanggal jatuh tempo sebelumnya tercatat — dosis pertama sebuah vaksin untuk seekor pasien tidak memiliki apa pun untuk dibandingkan sebagai "tepat waktu", jadi tidak dihitung — dan menampilkan persentase yang datang pada atau sebelum tanggal jatuh tempo itu, sebagai indikator keseluruhan ditambah rincian per vaksin. Ini adalah pertanyaan berbeda dari kartu vaksinasi Dashboard Anda sendiri (yang merupakan snapshot langsung "apa yang terlambat sekarang"): laporan ini melihat ke belakang pada periode tertentu, berguna untuk melihat apakah jadwal lanjutan vaksin tertentu terus-menerus meleset.

**Case-Type Volume Trend** menggambarkan berapa banyak kasus yang Anda tangani per jenis kasus, bulan demi bulan — satu garis per jenis. Jenis kasus Anda berasal langsung dari kategori yang telah Anda atur di Service Catalog Anda sendiri (Consultation, Grooming, Diagnostics, atau lainnya yang telah Anda tambahkan, termasuk Surgery jika Anda melacaknya di sana), ditambah garis khusus **Vaccinations** yang bersumber dari dosis yang benar-benar diberikan, bukan janji temu yang dipesan. Hanya janji temu yang tertaut ke pasien dan tidak dibatalkan yang dihitung sebagai kasus nyata.
