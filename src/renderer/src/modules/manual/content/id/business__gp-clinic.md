# Klinik Dokter Umum

Layar jenis bisnis ini hanya dalam bahasa Inggris, terlepas dari pengaturan bahasa Anda di tempat lain di Sarang.

## Fondasi layanan bersama

Setiap jenis bisnis berbasis layanan di Sarang — termasuk Klinik Dokter Umum — dimulai dari empat blok bangunan yang sama: **Janji Temu** (memesan dan menjadwalkan kunjungan), sebuah **Katalog Layanan** (daftar konsultasi dan harganya), **Provider Schedules** (dokter mana yang tersedia kapan), dan sebuah **Notification Queue** otomatis yang menangani pengingat tanpa Anda harus mengirimnya secara manual. Sisa bab ini membahas apa yang spesifik untuk klinik dokter umum: catatan konsultasi dan antrean token walk-in.

## Consultation Notes (Visit Notes)

Membuka **Consultation Note** sebuah janji temu memberi Anda catatan klinis terstruktur berformat SOAP:

- **Patient Information** — nama, usia, keluhan utama.
- **S — Subjective**: apa yang dilaporkan pasien (riwayat, gejala, onset).
- **Vitals**: tekanan darah (sistolik/diastolik), denyut nadi, suhu, tinggi, berat — setiap field ditandai otomatis (Normal / Low / High) terhadap referensi rentang normal yang tersimpan setelah Anda menyimpan, sehingga pembacaan di luar rentang langsung terlihat.
- **O — Objective**: temuan pemeriksaan.
- **A — Assessment**: diagnosis / kesan klinis.
- **P — Plan**: rencana pengobatan, obat-obatan, pemeriksaan yang dipesan.
- **Follow-up**: tanggal follow-up opsional dan instruksi.

Klik **Save Note** sambil berjalan, lalu **Selesaikan** saat konsultasi selesai. Sebuah catatan yang di-finalize menjadi read-only (ditampilkan dengan lencana kunci) — ini melindungi catatan klinis dari perubahan setelah fakta. Anda dapat **Print Summary** kapan saja untuk memberikan pasien (atau menyimpan untuk arsip Anda) sebuah ringkasan kunjungan terformat, yang membawa disclaimer jelas bahwa ini adalah dokumen kenyamanan yang dihasilkan oleh Sarang, bukan catatan medis tervalidasi — selalu verifikasi sebelum penggunaan klinis.

**Prescription.** Tambahkan sebuah resep sungguhan sebagai daftar berbutir tersendiri — nama obat, dosis, frekuensi, durasi, dan instruksi, satu baris per obat — terpisah dari field Plan teks bebas di atas. **Print Prescription** menghasilkan dokumen ℞ yang layak dengan tabel obat berbutir (tidak seperti ringkasan kunjungan umum, yang ini dimaksudkan untuk berfungsi sebagai resep sungguhan, jadi tidak membawa disclaimer "bukan catatan tervalidasi" — hanya perlu tanda tangan/stempel Anda agar valid).

**Vitals Trend.** Setelah seorang pasien memiliki dua kunjungan atau lebih dengan tanda vital tercatat, sebuah grafik tren muncul menunjukkan bagaimana sebuah metrik pilihan (BP, denyut nadi, suhu, atau berat) bergerak dari waktu ke waktu — pilih metrik mana yang akan diplot dari baris chip di atas grafik.

**Referral letters.** Menggunakan aksi "Refer to Another Provider" yang ada membuat sebuah rujukan sungguhan; setelah ada satu, **Print Referral Letter** menghasilkan sebuah surat formal yang ditujukan kepada dokter yang dirujuk dengan alasan rujukan — sebuah dokumen yang sungguh berbeda dari ringkasan konsultasi lengkap, dibuat untuk diberikan kepada pasien untuk dibawa ke spesialis.

## Token Queue

Layar **Antrean Token** mengelola pasien walk-in hari yang sama tanpa memerlukan janji temu yang dipesan sebelumnya. Ini menampilkan:

- Tampilan **Now Serving** besar dari nomor token saat ini dan nama pasien.
- Chip hitungan untuk Waiting / Called / Seen / Skipped.
- **Add Walk-in** untuk menerbitkan token baru (nama pasien, usia, jenis kelamin, telepon, catatan).
- **Call Next** untuk memanggil token menunggu berikutnya.

Setiap token dalam daftar dapat dipanggil, ditandai seen, dilewati, atau direset kembali ke waiting — antrean menyortir ulang dirinya sendiri secara otomatis ke bagian "Currently Called," "Waiting," dan "Completed." Ini sepenuhnya terpisah dari daftar Appointments yang dipesan sebelumnya — dibuat untuk realitas pasien yang sekadar datang dan menunggu giliran mereka.

## Pengingat Kondisi Kronis

Untuk pasien dengan kondisi berkelanjutan — diabetes, hipertensi, dan sejenisnya — yang memerlukan tindak lanjut berkala terlepas dari apakah mereka memesan janji temu baru, layar **Chronic Recall** (di sidebar) memungkinkan Anda menandai pasien dengan suatu kondisi dan jadwal pengingat, terpisah dari kunjungan tunggal mana pun.

- **Tag Condition** — pilih pasien, beri nama kondisinya (kondisi umum seperti Diabetes dan Hypertension disarankan, tetapi Anda dapat mengetik kondisi apa pun), opsional catat kapan didiagnosis, dan tetapkan tanggal kunjungan ini beserta tanggal pengingat berikutnya yang Anda inginkan mereka kembali.
- Daftar mengelompokkan setiap pasien yang dilacak ke dalam **Overdue**, **Due Soon** (dalam 7 hari), **This Month**, dan **Upcoming** — klik pasien mana pun untuk mencatat kunjungan tindak lanjut aktual mereka dan menetapkan tanggal pengingat berikutnya, dengan cara yang sama seperti Anda menetapkan yang pertama.
- Setiap kali Anda mencatat tindak lanjut, Sarang diam-diam mencatat apakah itu terjadi pada atau sebelum tanggal pengingat yang jatuh tempo. Seiring waktu ini membangun **persentase kepatuhan** yang nyata — ditampilkan di bagian atas layar dan pada kartu Chronic Recall di Dashboard Anda — menunjukkan berapa persen pengingat yang benar-benar dipenuhi, bukan hanya berapa banyak yang dijadwalkan.
- Seorang pasien dapat ditandai dengan lebih dari satu kondisi sekaligus (misalnya diabetes dan hipertensi bersamaan), masing-masing dilacak dan diingatkan secara independen.

Ini terpisah dari tanggal **Follow-up** satu kali milik Catatan Konsultasi di atas — itu untuk "kembali setelah kunjungan spesifik ini"; Chronic Recall untuk "pasien ini memiliki kondisi berkelanjutan yang perlu terus saya periksa, kunjungan demi kunjungan."

Angka kepatuhan yang sama juga memiliki laporan khususnya sendiri — buka **Reports → Recall Compliance**, pilih rentang tanggal, dan Anda akan melihat pengukur yang menunjukkan persentase pengingat yang ditutup dalam rentang tersebut dan ditepati tepat waktu, ditambah rincian per kondisi (sehingga Anda dapat mengetahui, misalnya, bahwa pengingat diabetes Anda berjalan di 90% tetapi hipertensi mulai menurun).
