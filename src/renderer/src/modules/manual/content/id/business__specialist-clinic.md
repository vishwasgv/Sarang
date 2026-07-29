# Klinik Spesialis

Layar jenis bisnis ini hanya dalam bahasa Inggris, terlepas dari pengaturan bahasa Anda di tempat lain di Sarang.

## Fondasi layanan bersama

Setiap jenis bisnis berbasis layanan di Sarang — termasuk Klinik Spesialis — dimulai dari empat blok bangunan yang sama: **Appointments** (memesan dan menjadwalkan kunjungan), sebuah **Service Catalog** (daftar konsultasi dan prosedur yang ditawarkan praktik Anda), **Provider Schedules** (spesialis mana yang tersedia kapan), dan sebuah **Notification Queue** otomatis yang menangani pengingat tanpa Anda harus mengirimnya secara manual. Sisa bab ini membahas apa yang spesifik untuk praktik spesialis.

Sarang secara sengaja tidak memiliki jenis bisnis terpisah per spesialisasi medis (THT, mata, dermatologi, kardiologi, dan seterusnya). Sebaliknya, "Specialist Clinic" dibuat untuk mencakup **spesialisasi apa pun** melalui Service Catalog generik yang sama — Anda mendefinisikan jenis konsultasi dan prosedur Anda sendiri dengan harga Anda sendiri, dan catatan klinis di bawah beradaptasi untuk membawa field khusus-spesialis terlepas dari spesialisasi Anda.

## Consultation Notes dengan Referral Details

Membuka **Consultation Note** sebuah janji temu memberi Anda catatan SOAP terstruktur yang sama yang digunakan di seluruh jenis bisnis klinis Sarang (Patient Information, Subjective, Vitals dengan penandaan otomatis, Objective, Assessment, Plan, Follow-up) — lihat bab *Klinik Dokter Umum* untuk penjelasan lengkap field demi field — ditambah bagian **Referral Details** yang unik untuk Klinik Spesialis:

- **Referred By** dan **Referral Date** — mencatat siapa yang mengirim pasien ini kepada Anda (dokter luar atau klinik lain) dan kapan.
- **Referral Reason** — teks bebas.

Ini terpisah dari **Refer to Another Provider**, sebuah aksi sungguhan di dalam aplikasi lebih bawah di layar yang sama: setelah catatan disimpan, Anda dapat memesan janji temu keluar sungguhan dengan penyedia lain di klinik Anda sendiri (pilih penyedia, tanggal, waktu, dan alasan opsional) — ini adalah janji temu yang benar-benar dipesan, bukan sekadar catatan. Setiap rujukan yang Anda kirim menampilkan statusnya sendiri (Scheduled / Completed / Cancelled / No-show) tepat di catatan kunjungan, dengan sebuah tombol **Print Referral Letter** yang menghasilkan surat formal yang ditujukan kepada penyedia yang dirujuk.

Catatan tersebut juga membawa tabel **Prescription** berbutir yang sama dan grafik **Vitals Trend** yang dijelaskan di bab *Klinik Dokter Umum* — keduanya bekerja identik di sini.

## Token Queue

Klinik Spesialis juga mencakup layar **Token Queue** untuk walk-in hari yang sama, persis seperti yang dijelaskan di bab *Klinik Dokter Umum* — menerbitkan token walk-in, memanggil pasien berikutnya, dan melacak jumlah Waiting / Called / Seen / Skipped. Antrean walk-in sama umumnya di praktik rawat jalan spesialis (kamp THT, kamp mata, klinik dermatologi) seperti halnya di praktik umum.

## Printing

**Print Summary** menghasilkan ringkasan kunjungan terformat termasuk bagian rujukan saat diisi, dengan disclaimer klinis yang sama yang digunakan di seluruh dokumen medis Sarang: ini adalah dokumen kenyamanan yang dihasilkan oleh Sarang, bukan catatan medis tervalidasi — selalu verifikasi sebelum penggunaan klinis.
