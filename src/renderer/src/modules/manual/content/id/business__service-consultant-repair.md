# Service / Consultant / Repair

Ini adalah tiga jenis bisnis asli Sarang yang bersifat serba-guna — untuk bisnis mana pun yang tidak sesuai dengan template vertikal tertentu tetapi melakukan pekerjaan bergaya proyek, tiket, atau perbaikan: seorang kontraktor umum, konsultan lepas, bengkel perbaikan kecil, penyedia dukungan IT, dan sejenisnya. Ketiganya menjalankan antarmuka Sarang dalam bahasa pilihan normal Anda (ketiga jenis ini bukan bagian dari 24 template vertikal-layanan spesifik, sehingga tidak ada penguncian bahasa-Inggris-saja di sini).

Mereka berbagi satu model dasar generik yang sama — Projects, Job Cards, Service Tickets, Work Tracking, dan Customer History — tetapi setiap jenis bisnis mengaktifkan kombinasi berbeda darinya:

- **Service** mendapatkan Projects, Service Tickets, dan Work Tracking — bisnis yang melakukan baik pekerjaan bergaya proyek maupun permintaan dukungan ad-hoc.
- **Consultant** hanya mendapatkan Projects dan Work Tracking, tanpa Job Cards atau Service Tickets — praktik proyek/jam-tagihan murni.
- **Repair** mendapatkan Job Cards dan Service Tickets, tanpa Projects — bisnis yang dibangun di sekitar barang individual yang dibawa pelanggan, bukan keterlibatan multi-tugas.

Ketiganya juga mendapatkan **Customer History**, tampilan terpadu dari segala sesuatu yang terkait dengan seorang pelanggan terlepas dari model mana yang menghasilkannya.

## Projects (Service, Consultant)

Sebuah proyek memiliki judul, prioritas (Low/Medium/High/Urgent), pelanggan dan penerima tugas opsional, estimasi jam/jumlah, dan tenggat waktu. Ia bergerak melalui lima status — Open, In Progress, On Hold, Completed, Cancelled — yang Anda ubah secara bebas dari tampilan detail proyek.

Membuka layar detail sebuah proyek memberi Anda dua hal lagi:

- **Tasks** — daftar periksa sederhana yang Anda centang; daftar proyek menampilkan progress bar "selesai / total" yang dihitung dari ini.
- **Work Logs** — jam yang dicatat terhadap proyek, masing-masing ditandai billable atau non-billable, dengan total berjalan yang ditampilkan baik di tampilan daftar maupun detail.

## Job Cards (Repair, Service lewat model generik)

Sebuah job card dibuat untuk barang fisik yang dibawa pelanggan: judul, deskripsi barang, prioritas, estimasi biaya, dan tanggal diterima/diharapkan/diserahkan. Ia memiliki siklus hidup tujuh-tahap sendiri — **Received → Diagnosing → In Repair → (opsional Pending Parts) → Ready → Delivered**, atau **Cancelled** pada titik mana pun sebelum diserahkan. Tampilan detail menunjukkan ini sebagai pelacak tahap visual dan selalu menampilkan satu tombol tindakan-berikutnya (misalnya "Mark In Repair"), plus tindakan "Waiting for Parts" khusus saat sebuah kartu sedang dalam perbaikan. Menyerahkan sebuah job card adalah tempat Anda memasukkan biaya akhir sebenarnya, terpisah dari estimasi aslinya.

## Service Tickets (Service, Repair)

Sebuah tiket adalah permintaan dukungan yang lebih ringan: judul, deskripsi, prioritas, tag kategori opsional, dan pelanggan/penerima tugas opsional. Ia bergerak melalui **Open → In Progress → Resolved → Closed**, dan menyelesaikan satu memungkinkan Anda melampirkan catatan resolusi. Tiket urgent yang belum terselesaikan ditandai dengan indikator bendera-merah pada daftar sehingga tidak terkubur.

## Work Tracking

Sebuah lembar waktu gabungan tunggal di seluruh apa pun yang diaktifkan jenis bisnis ini — sebuah Project, Job Card, atau Ticket — menunjukkan total jam, jam billable, dan jam non-billable sekilas. Setiap jam yang dicatat di sini bersifat billable-atau-tidak sesuai pilihan Anda saat entri, dan setiap entri tertaut kembali ke catatan tempat ia dicatat.

## Customer History

Untuk pelanggan mana pun, sebuah tampilan yang dapat diperluas mendaftar setiap faktur, proyek, tiket layanan, dan job card yang terkait dengan mereka dalam satu tempat, masing-masing ditampilkan dengan status dan tanggalnya sendiri — cara cepat untuk menjawab "apa yang pernah dilakukan pelanggan ini bersama kita sebelumnya" tanpa mencari di layar terpisah.
