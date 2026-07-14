# Log Audit

**Log Audit** (sidebar) adalah catatan permanen dari tindakan-tindakan penting yang dilakukan di Sarang — siapa melakukan apa, dan kapan. Ini ada agar Anda selalu bisa menjawab "siapa yang mengubah ini?" atau "siapa yang masuk dan kapan?", dan untuk membantu menemukan sesuatu yang tidak biasa.

## Apa yang dicatat

Sarang mencatat entri audit untuk tindakan di seluruh aplikasi, termasuk (di antara banyak lainnya): login, logout, dan percobaan login gagal pengguna; perubahan kata sandi; pembuatan dan pembatalan faktur; pembayaran yang dicatat dan dibatalkan; stok yang ditambahkan atau disesuaikan; cadangan yang dibuat, dipulihkan, atau dihapus; dan perubahan pada pengaturan bisnis. Setiap entri menampilkan tanggal dan waktu, tindakan (misalnya "INVOICE CREATED", "PAYMENT REVERSED"), entitas yang terpengaruh (misalnya Faktur atau Produk mana), dan pengguna mana yang melakukannya — atau "System" jika tidak terkait dengan pengguna login tertentu.

## Melihat dan memfilter log

Layar Log Audit mendaftar entri dari yang terbaru, 50 per halaman, dengan kontrol halaman **Previous/Next**. Gunakan dropdown jenis-entitas di bagian atas untuk memfilter ke jenis catatan tertentu (User, Invoice, Payment, Inventory, Product, Customer, Backup, dan banyak jenis entitas khusus bisnis lainnya). Klik **View** pada baris mana pun yang memiliki detail tercatat untuk memperluasnya dan melihat nilai lama dan baru yang terlibat dalam tindakan tersebut (ditampilkan sebagai data yang dapat dibaca, bukan kode mentah).

Entri yang sangat lama secara otomatis dibersihkan setelah periode retensi yang dapat dikonfigurasi (2 tahun secara default) sehingga log tidak tumbuh selamanya — ini hanya menghapus riwayat lama yang benar-benar lama, bukan apa pun yang baru-baru ini.

## Memverifikasi riwayat audit Anda belum dimanipulasi

Klik **Verifikasi Integritas** di bagian atas layar Log Audit. Sarang dapat memverifikasi bahwa seluruh riwayat audit Anda belum dimanipulasi — setiap entri secara diam-diam terhubung ke entri sebelumnya saat dibuat, sehingga jika seseorang pernah bisa masuk dan diam-diam mengedit atau menghapus entri lama (misalnya, untuk menyembunyikan bahwa sebuah faktur yang dibatalkan sebenarnya terjadi, atau untuk menghapus penyesuaian stok yang mencurigakan), tautan itu akan putus dan Sarang akan mendeteksinya.

Menjalankan pemeriksaan ini akan memberi tahu Anda salah satu dari:
- **Rantai utuh** — menunjukkan berapa banyak entri yang diverifikasi, mengonfirmasi tidak ada yang diubah dalam riwayat tercatat Anda.
- **Rantai terputus** — menunjuk kira-kira di mana keretakan ditemukan, sehingga Anda tahu ada sesuatu dalam jejak audit Anda yang tidak sesuai dengan seharusnya.

Pemeriksaan ini dijalankan sesuai permintaan (tidak otomatis pada setiap peluncuran aplikasi, karena memeriksa riwayat besar adalah pekerjaan nyata) — jalankan kapan saja Anda ingin memastikan catatan Anda dapat dipercaya, misalnya sebelum mengandalkan log audit untuk menyelesaikan sebuah sengketa.
