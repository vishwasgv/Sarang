# Bengkel Servis Mobil

## Apa yang termasuk

Car Service Center dibangun di atas fondasi bisnis-layanan bersama Sarang — appointments, sebuah service catalog, provider schedules, dan notification queue — plus satu modul khusus: **Job Cards**.

## Job Cards

Setiap job card mencatat klien dan kendaraan — nomor kendaraan, merek, model, tahun, jenis kendaraan (2W, 4W, Commercial, Other), pembacaan odometer masuk (dan keluar, setelah kendaraan dikembalikan), service advisor, dan satu atau lebih teknisi yang ditugaskan.

Sebuah job card membawa dua daftar item baris:

- **Service items** — biaya tenaga kerja: nama, kuantitas, dan tarif, dijumlahkan sebagai total tenaga kerja.
- **Parts** — baik diketik sebagai teks bebas (suku cadang sourced sekali-pakai, tidak dilacak terhadap stok), atau ditambahkan dengan **mencari inventaris Anda yang sebenarnya**, yang menautkan baris ke sebuah Product sungguhan. Sebuah suku cadang yang tertaut adalah yang membuat penagihan benar-benar menguranginya dari stok saat job card difaktur; suku cadang teks bebas tidak pernah menyentuh inventaris.

Sebuah job card bergerak melalui pipeline status: **Received → Inspection → In Progress → (Waiting Parts, jika perlu) → Ready → Delivered**, dengan Cancelled sebagai hasil terpisah. Setelah Ready, sebuah tombol **Generate Invoice** menagih tenaga kerja dan suku cadang bersama sebagai faktur sungguhan.

Tetapkan tanggal **next service due** dan/atau pembacaan odometer pada sebuah job card, dan klik **Remind** untuk menjadwalkan pengingat WhatsApp sungguhan ke klien menjelang itu. Buka tab **Vehicles** untuk melihat setiap kendaraan berbeda yang pernah Anda servis, dikelompokkan berdasarkan nomor registrasi dengan lencana Due Soon/Overdue — klik **History** pada kendaraan mana pun untuk riwayat servis lengkapnya yang dikelompokkan, terbaru dulu.

Bar KPI menampilkan pekerjaan aktif, pekerjaan siap diambil, dan pekerjaan terkirim bulan ini.

## Bahasa

Car Service Center adalah salah satu dari 24 template bisnis-layanan khusus Sarang, dan seperti hampir semuanya antarmukanya **hanya bahasa Inggris**, terlepas dari bahasa mana yang telah Anda tetapkan di tempat lain di Sarang.
