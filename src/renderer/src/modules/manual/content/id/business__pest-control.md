# Pengendalian Hama

## Apa yang termasuk

Pest Control dibangun di atas fondasi bisnis-layanan bersama Sarang — appointments, sebuah service catalog, provider schedules, dan notification queue — plus satu modul khusus: **Pest Control**, mencakup baik kontrak layanan berulang maupun lembar kerja individual.

## Service Contracts

Sebuah kontrak mencatat klien, alamat dan jenis properti (Residential, Commercial, Industrial), jenis hama yang dicakup (Cockroaches, Rodents, Termites, Ants, Mosquitoes, Bedbugs, Other — pilih sebanyak yang berlaku), frekuensi layanan (Monthly, Quarterly, Half-Yearly, Yearly, One-Time), nilai kontrak, tanggal mulai/selesai, dan status (Active, Pending, Expired, Cancelled).

Sebuah kontrak aktif dengan nilai dapat difaktur untuk biaya berulangnya dengan **Generate Invoice** — ini bukan aksi sekali-pakai: Sarang melacak periode mana kontrak terakhir difaktur, sehingga Anda dapat menagih kontrak yang sama lagi setiap periode berulangnya, pada kadensi apa pun yang sesuai dengan frekuensinya sendiri. Faktur kontrak menggunakan SAC 998534 pada GST 18%.

## Job Sheets

Sebuah job sheet adalah satu kunjungan — opsional tertaut ke sebuah kontrak, atau dibuat sebagai kunjungan sekali-waktu/ad-hoc, mencatat tanggal/waktu kunjungan, teknisi yang ditugaskan, pestisida yang digunakan, area yang dilayani (daftar pilihan cepat: Kitchen, Bathrooms, Bedroom, Store Room, Terrace, Garden, Basement, Office, Warehouse, Restaurant Kitchen, Common Areas), jenis perawatan (Spray, Gel, Fumigation, Trap, Bait, Combined), jumlah pekerjaan, dan apakah tanda tangan klien diperoleh. Sebuah job sheet bergerak melalui **Scheduled → In Progress → Completed** (dengan Cancelled sebagai hasil terpisah); setelah Completed, **Generate Invoice** menagih kunjungan tersebut (SAC 998534 yang sama, GST 18%).

Untuk catatan sungguhan dan berbutir tentang bahan kimia apa yang benar-benar digunakan pada sebuah kunjungan, tambahkan baris ke **Pesticides Used** — nama, kuantitas, unit, hama target, dan catatan dosis opsional. Tautkan sebuah baris ke produk inventaris sungguhan agar mengurangi stok secara otomatis saat digunakan, atau biarkan tidak tertaut untuk toko yang tidak melacak stok bahan kimia di Sarang.

Bar KPI menampilkan kontrak aktif, job sheet tertunda, dan job sheet terjadwal minggu ini.

## Bahasa

Pest Control adalah salah satu dari 24 template bisnis-layanan khusus Sarang, dan seperti hampir semuanya antarmukanya **hanya bahasa Inggris**, terlepas dari bahasa mana yang telah Anda tetapkan di tempat lain di Sarang.
