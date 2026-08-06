# Arsitek

Layar jenis bisnis ini hanya dalam bahasa Inggris, terlepas dari pengaturan bahasa Anda di tempat lain di Sarang.

## Fondasi layanan bersama

Setiap jenis bisnis berbasis layanan di Sarang — termasuk Architect — dimulai dari empat blok bangunan yang sama: **Janji Temu** (memesan pertemuan klien), sebuah **Katalog Layanan** (daftar layanan dan harganya), **Provider Schedules** (anggota tim mana yang tersedia kapan), dan sebuah **Notification Queue** otomatis yang menangani pengingat tanpa Anda harus mengirimnya secara manual. Sisa bab ini membahas apa yang spesifik untuk praktik arsitektur: pipeline lead, manajemen proyek, pelacakan waktu, dan register gambar.

## Leads

**Prospek** adalah pipeline bergaya Kanban dari calon klien: Open → Contacted → Proposal → Won → Lost. Seret sebuah kartu lead antar kolom untuk memperbarui statusnya, atau tambahkan lead baru dengan nama, detail kontak, perusahaan, sumber (Referral, Website, Walk-In, Social, Cold Call, Other), nilai estimasi, dan anggota tim yang ditugaskan.

## Projects

**Service Projects** melacak setiap keterlibatan klien dari kontrak hingga selesai — nama proyek, jenis, tahap, status (Active / On Hold / Completed / Cancelled), total nilai kontrak, tanggal mulai dan perkiraan selesai, dan anggota tim yang ditugaskan. Setiap proyek dapat membawa **milestones** — deliverable bernama dengan jumlah dan tanggal jatuh tempo sendiri — dan setelah sebuah milestone selesai, hasilkan faktur untuknya langsung dari proyek.

## Time Entries

Catat jam yang dapat ditagih terhadap sebuah proyek dari layar **Pelacakan Waktu** mandiri — tanggal, staf, deskripsi, jam, tarif, dan jumlah yang dihitung — dapat difilter berdasarkan staf, proyek, rentang tanggal, dan status ditagih. Pilih entri yang belum ditagih dan **Buat Faktur** untuk menagih klien langsung.

## Drawing Register

**Register Gambar** adalah pembeda sungguhan sehari-hari untuk praktik arsitektur: untuk setiap proyek, lacak setiap gambar yang Anda terbitkan — nomor gambar, judul, disiplin (Architectural, Structural, MEP, Landscape, Interior), nomor revisi, status (Draft / Issued for Review / Approved / Superseded), dan tanggal terbit. Ubah status sebuah gambar langsung dari daftar saat bergerak melalui review, dan lampirkan file (dokumen gambar sebenarnya) ke setiap revisi gambar.

Gambar dikelompokkan berdasarkan nomor gambar, dengan revisi saat ini ditampilkan sebagai baris utama. Klik **New Revision** untuk menerbitkan revisi berikutnya dari sebuah gambar — Sarang membuat catatan yang sungguh baru dan terpisah dan secara otomatis menandai yang sebelumnya Superseded, sehingga Anda selalu memiliki perbandingan Rev A vs. Rev B yang sungguhan, bukan hanya satu field yang ditimpa. Buka **History** pada gambar mana pun untuk melihat setiap revisi masa lalunya.

Memindahkan sebuah gambar ke **Disetujui** memerlukan pencatatan siapa yang benar-benar menyetujui — Sarang akan meminta nama penyetuju jika belum tercatat, dan tidak akan membiarkan perubahan status berlanjut tanpanya. Ini memberi Anda jejak persetujuan klien yang sungguhan, bukan sekadar label status.
