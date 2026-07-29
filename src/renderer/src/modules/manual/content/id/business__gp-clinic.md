# Klinik Dokter Umum

Layar jenis bisnis ini hanya dalam bahasa Inggris, terlepas dari pengaturan bahasa Anda di tempat lain di Sarang.

## Fondasi layanan bersama

Setiap jenis bisnis berbasis layanan di Sarang — termasuk Klinik Dokter Umum — dimulai dari empat blok bangunan yang sama: **Appointments** (memesan dan menjadwalkan kunjungan), sebuah **Service Catalog** (daftar konsultasi dan harganya), **Provider Schedules** (dokter mana yang tersedia kapan), dan sebuah **Notification Queue** otomatis yang menangani pengingat tanpa Anda harus mengirimnya secara manual. Sisa bab ini membahas apa yang spesifik untuk klinik dokter umum: catatan konsultasi dan antrean token walk-in.

## Consultation Notes (Visit Notes)

Membuka **Consultation Note** sebuah janji temu memberi Anda catatan klinis terstruktur berformat SOAP:

- **Patient Information** — nama, usia, keluhan utama.
- **S — Subjective**: apa yang dilaporkan pasien (riwayat, gejala, onset).
- **Vitals**: tekanan darah (sistolik/diastolik), denyut nadi, suhu, tinggi, berat — setiap field ditandai otomatis (Normal / Low / High) terhadap referensi rentang normal yang tersimpan setelah Anda menyimpan, sehingga pembacaan di luar rentang langsung terlihat.
- **O — Objective**: temuan pemeriksaan.
- **A — Assessment**: diagnosis / kesan klinis.
- **P — Plan**: rencana pengobatan, obat-obatan, pemeriksaan yang dipesan.
- **Follow-up**: tanggal follow-up opsional dan instruksi.

Klik **Save Note** sambil berjalan, lalu **Finalize** saat konsultasi selesai. Sebuah catatan yang di-finalize menjadi read-only (ditampilkan dengan lencana kunci) — ini melindungi catatan klinis dari perubahan setelah fakta. Anda dapat **Print Summary** kapan saja untuk memberikan pasien (atau menyimpan untuk arsip Anda) sebuah ringkasan kunjungan terformat, yang membawa disclaimer jelas bahwa ini adalah dokumen kenyamanan yang dihasilkan oleh Sarang, bukan catatan medis tervalidasi — selalu verifikasi sebelum penggunaan klinis.

**Prescription.** Tambahkan sebuah resep sungguhan sebagai daftar berbutir tersendiri — nama obat, dosis, frekuensi, durasi, dan instruksi, satu baris per obat — terpisah dari field Plan teks bebas di atas. **Print Prescription** menghasilkan dokumen ℞ yang layak dengan tabel obat berbutir (tidak seperti ringkasan kunjungan umum, yang ini dimaksudkan untuk berfungsi sebagai resep sungguhan, jadi tidak membawa disclaimer "bukan catatan tervalidasi" — hanya perlu tanda tangan/stempel Anda agar valid).

**Vitals Trend.** Setelah seorang pasien memiliki dua kunjungan atau lebih dengan tanda vital tercatat, sebuah grafik tren muncul menunjukkan bagaimana sebuah metrik pilihan (BP, denyut nadi, suhu, atau berat) bergerak dari waktu ke waktu — pilih metrik mana yang akan diplot dari baris chip di atas grafik.

**Referral letters.** Menggunakan aksi "Refer to Another Provider" yang ada membuat sebuah rujukan sungguhan; setelah ada satu, **Print Referral Letter** menghasilkan sebuah surat formal yang ditujukan kepada dokter yang dirujuk dengan alasan rujukan — sebuah dokumen yang sungguh berbeda dari ringkasan konsultasi lengkap, dibuat untuk diberikan kepada pasien untuk dibawa ke spesialis.

## Token Queue

Layar **Token Queue** mengelola pasien walk-in hari yang sama tanpa memerlukan janji temu yang dipesan sebelumnya. Ini menampilkan:

- Tampilan **Now Serving** besar dari nomor token saat ini dan nama pasien.
- Chip hitungan untuk Waiting / Called / Seen / Skipped.
- **Add Walk-in** untuk menerbitkan token baru (nama pasien, usia, jenis kelamin, telepon, catatan).
- **Call Next** untuk memanggil token menunggu berikutnya.

Setiap token dalam daftar dapat dipanggil, ditandai seen, dilewati, atau direset kembali ke waiting — antrean menyortir ulang dirinya sendiri secara otomatis ke bagian "Currently Called," "Waiting," dan "Completed." Ini sepenuhnya terpisah dari daftar Appointments yang dipesan sebelumnya — dibuat untuk realitas pasien yang sekadar datang dan menunggu giliran mereka.
