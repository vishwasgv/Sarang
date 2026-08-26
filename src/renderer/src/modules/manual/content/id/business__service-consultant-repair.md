# Service / Consultant / Repair

Ini adalah tiga jenis bisnis asli Sarang yang bersifat serba-guna — untuk bisnis mana pun yang tidak sesuai dengan template vertikal tertentu tetapi melakukan pekerjaan bergaya proyek, tiket, atau perbaikan: seorang kontraktor umum, konsultan lepas, bengkel perbaikan kecil, penyedia dukungan IT, dan sejenisnya. Ketiganya menjalankan antarmuka Sarang dalam bahasa pilihan normal Anda (ketiga jenis ini bukan bagian dari 24 template vertikal-layanan spesifik, sehingga tidak ada penguncian bahasa-Inggris-saja di sini).

Mereka berbagi satu model dasar generik yang sama — Projects, Job Cards, Service Tickets, Work Tracking, dan Customer History — tetapi setiap jenis bisnis mengaktifkan kombinasi berbeda darinya:

- **Servis** mendapatkan Projects, Service Tickets, dan Work Tracking — bisnis yang melakukan baik pekerjaan bergaya proyek maupun permintaan dukungan ad-hoc.
- **Consultant** hanya mendapatkan Projects dan Work Tracking, tanpa Job Cards atau Service Tickets — praktik proyek/jam-tagihan murni.
- **Perbaikan** mendapatkan Job Cards dan Service Tickets, tanpa Projects — bisnis yang dibangun di sekitar barang individual yang dibawa pelanggan, bukan keterlibatan multi-tugas.

Ketiganya juga mendapatkan **Riwayat Pelanggan**, tampilan terpadu dari segala sesuatu yang terkait dengan seorang pelanggan terlepas dari model mana yang menghasilkannya.

## Projects (Service, Consultant)

Sebuah proyek memiliki judul, prioritas (Low/Medium/High/Urgent), pelanggan dan penerima tugas opsional, estimasi jam/jumlah, dan tenggat waktu. Ia bergerak melalui lima status — Open, In Progress, On Hold, Completed, Cancelled — yang Anda ubah secara bebas dari tampilan detail proyek.

Membuka layar detail sebuah proyek memberi Anda dua hal lagi:

- **Tugas** — daftar periksa sederhana yang Anda centang; daftar proyek menampilkan progress bar "selesai / total" yang dihitung dari ini.
- **Work Logs** — jam yang dicatat terhadap proyek, masing-masing ditandai billable atau non-billable, dengan total berjalan yang ditampilkan baik di tampilan daftar maupun detail.

Got an accepted **Quotation** you use as an engagement letter? Pick it from the **Convert From Quotation** dropdown when creating a project, and Sarang links the two — one quotation can only ever convert into one project, so it's a real record of how many of your engagement letters actually became billed work.

**Consultant** also sees a running **proposal win rate** next to the project count in the header — won versus lost versus still-pending Quotations, so you always know at a glance how your pipeline of engagement letters is converting, not just how many projects are currently open.

## Job Cards (Repair, Service lewat model generik)

Sebuah job card dibuat untuk barang fisik yang dibawa pelanggan: judul, deskripsi barang, prioritas, estimasi biaya, dan tanggal diterima/diharapkan/diserahkan. Ia memiliki siklus hidup tujuh-tahap sendiri — **Received → Diagnosing → In Repair → (opsional Pending Parts) → Ready → Delivered**, atau **Dibatalkan** pada titik mana pun sebelum diserahkan. Tampilan detail menunjukkan ini sebagai pelacak tahap visual dan selalu menampilkan satu tombol tindakan-berikutnya (misalnya "Mark In Repair"), plus tindakan "Waiting for Parts" khusus saat sebuah kartu sedang dalam perbaikan. Menyerahkan sebuah job card adalah tempat Anda memasukkan biaya akhir sebenarnya, terpisah dari estimasi aslinya — **Buat Faktur** mengubah biaya akhir tersebut menjadi faktur sungguhan begitu pekerjaan telah diserahkan.

Tambahkan **suku cadang terpakai** yang sungguhan ke sebuah job card dari tampilan detailnya — cari sebuah produk, atur kuantitasnya, dan Sarang menguranginya dari inventaris Anda yang sebenarnya (bukan sekadar catatan teks bebas); menghapus sebuah suku cadang mengembalikan stoknya. Atur **periode garansi** dalam hari saat penyerahan, dan sebuah lencana Under Warranty / Expired yang sungguhan otomatis muncul sejak titik itu. Jika barang yang sama kembali karena masalah garansi, mulai sebuah job card baru dan tautkan sebagai sebuah **klaim garansi** terhadap yang asli — status garansi langsung dari job card asli ditampilkan tepat di formulir job card baru tersebut.

At intake, record the item's **condition on arrival** and **accessories received** — real dispute protection, so "the customer said the charger was included" is answerable by pointing at what was actually written down when the item came in, not relying on memory. Give the job a free-text **category** (e.g. "Screen Repair," "Battery Replacement") so repair volume can be tracked by type. If you know the cost of the parts up front, enter a **quoted parts total** at intake — once real parts are added later, the job card's own detail view shows the live **parts variance** between what was quoted and what was actually used, in red if it ran over.

Sarang also flags a **repeat fault** automatically: if the same customer brings back the same item within 30 days of a prior delivery, the new job card is flagged right at creation — a real quality signal, not something you have to notice yourself.

## Service Tickets (Service, Repair)

Sebuah tiket adalah permintaan dukungan yang lebih ringan: judul, deskripsi, prioritas, tag kategori opsional, dan pelanggan/penerima tugas opsional. Ia bergerak melalui **Open → In Progress → Resolved → Closed**, dan menyelesaikan satu memungkinkan Anda melampirkan catatan resolusi. Tiket urgent yang belum terselesaikan ditandai dengan indikator bendera-merah pada daftar sehingga tidak terkubur. Masukkan sebuah jumlah dan **Buat Faktur** untuk menagih sebuah tiket yang telah diselesaikan.

Every ticket also gets an **SLA timer** the moment it's created, sized to its priority (Urgent 4 hours, High 24 hours, Medium 3 days, Low 7 days). A ticket still open past its own SLA is flagged **SLA Breached** right on the list and in the header count — a real deadline alert, not just a priority label.

Got an accepted **Quotation** that turned into real work? Pick it from the **Convert From Quotation** dropdown when creating a ticket, and Sarang links the two — one quotation can only ever convert into one ticket, so it's a real record of how many of your estimates actually became billable jobs.

## Service Contracts (Service)

Open **Service Contracts** in the sidebar to run a recurring, AMC-like arrangement for a repeat customer — a fixed value, billed on a schedule (Monthly/Quarterly/Half-Yearly/Yearly) rather than negotiated fresh every visit. Create a contract with its scope of work, frequency, start date, and value, then click **Generate Invoice** whenever a billing period is due — Sarang tracks which period was last invoiced so the same period can never be billed twice, the same protection an ordinary retainer or AMC contract already has elsewhere in Sarang.

## Retainers (Consultant)

Open **Retainers** in the sidebar to run a recurring monthly arrangement for a repeat client — fixed fee, an hourly bucket, or a deliverable-based scope, billed on a schedule you set. For an hourly-bucket retainer, log time against it from **Time Tracking** and the retainer's own card shows a live **hours used / hours allocated** progress bar, turning red once the month's allowance is exhausted — the retainer burn-down at a glance, no separate report needed.

## Reports

Six reports are specific to this vertical set. **Resolution Time by Category** breaks down how long tickets actually take to close, average/fastest/slowest per category — a real service-quality metric, not just a status count. **Repeat-Business Rate** trends, month by month, what share of your ticket-raising customers are returning versus brand new — the retention signal this generic scaffold never had before. **Utilization Rate** (Consultant) is the #1 consulting metric: billable versus non-billable hours per staff member, sorted to surface whoever needs more billable work first. **Client Profitability** (Consultant) shows revenue against hours spent per client, sorted worst-first, so you can see at a glance which clients are actually worth keeping. **Turnaround by Technician** (Repair) shows how long job cards actually take to deliver, average/fastest/slowest per technician, sorted slowest-first. **Repair Category Volume Trend** (Repair) trends monthly repair volume by category — informs what parts you should be keeping in stock.

## Appointments dan penagihan Projects

Ketiga jenis bisnis ini juga mendapatkan **Janji Temu** (pemesanan, jadwal penyedia, dan pengingat — lihat bab *Billing* dan bab-bab universal) untuk menjadwalkan pertemuan klien atau slot drop-off, dan sebuah Project dapat ditagih langsung dengan **Buat Faktur** begitu sudah siap, dengan cara yang sama seperti sebuah Job Card atau Ticket.

## Work Tracking

Sebuah lembar waktu gabungan tunggal di seluruh apa pun yang diaktifkan jenis bisnis ini — sebuah Project, Job Card, atau Ticket — menunjukkan total jam, jam billable, dan jam non-billable sekilas. Setiap jam yang dicatat di sini bersifat billable-atau-tidak sesuai pilihan Anda saat entri, dan setiap entri tertaut kembali ke catatan tempat ia dicatat.

## Customer History

Untuk pelanggan mana pun, sebuah tampilan yang dapat diperluas mendaftar setiap faktur, proyek, tiket layanan, dan job card yang terkait dengan mereka dalam satu tempat, masing-masing ditampilkan dengan status dan tanggalnya sendiri — cara cepat untuk menjawab "apa yang pernah dilakukan pelanggan ini bersama kita sebelumnya" tanpa mencari di layar terpisah.
