# Cadangan & Pemulihan

Sarang menyimpan seluruh data bisnis Anda dalam satu file database lokal di komputer ini. Layar **Cadangan** (sidebar, atau **Settings → Backup & Recovery**) adalah tempat Anda melindungi data tersebut dari kegagalan disk, penghapusan tidak sengaja, atau mesin yang hilang/dicuri.

## Membuat cadangan manual

Klik **Buat Cadangan**. Sarang menjalankan pemeriksaan integritas database terlebih dahulu, membersihkan (flush) tulisan yang tertunda, lalu menghasilkan salinan bersih dan ter-defragmentasi dari database Anda, mem-checksum-nya, dan mengemasnya (bersama sebuah file metadata kecil) menjadi satu file `.sarang-backup`. Jika pemeriksaan integritas gagal, cadangan ditolak alih-alih menyimpan salinan yang mungkin rusak — Anda akan melihat sebuah error yang menjelaskan alasannya.

Setiap cadangan muncul dalam daftar **Riwayat Cadangan** dengan nama file, tanggal, ukuran, dan lencana status valid/tidak valid.

## Di mana cadangan disimpan

Secara default, cadangan disimpan ke folder data aplikasi ini sendiri pada disk yang sama dengan database aktif Anda (ditampilkan di bagian bawah layar Cadangan, dan biasanya di bawah `AppData\Sarang Business OS Lite\backups\` pada Windows). Karena itu adalah disk yang sama dengan tempat data aktif Anda berada, kegagalan disk akan menghancurkan cadangan itu juga.

Saat pertama kali Anda masuk, Sarang menampilkan prompt satu kali **"Jaga cadangan Anda tetap aman"** yang mendorong Anda untuk memilih lokasi cadangan yang berbeda — drive USB eksternal, disk kedua, atau folder jaringan — segera. Anda bisa melewatinya, dan mengubah ini kapan saja nanti dari tombol **Pilih Folder…** pada layar Cadangan (pengaturan khusus owner/admin). Jika folder yang dikonfigurasi menjadi tidak terjangkau (misalnya drive USB tidak terpasang), Sarang secara otomatis kembali ke folder lokal default untuk cadangan tersebut alih-alih gagal secara diam-diam, dan menandai ini di layar. Cadangan selalu disimpan ke disk lokal atau folder jaringan yang Anda pilih — tidak pernah ke layanan cloud mana pun.

## Cadangan otomatis

Seorang admin dapat mengaktifkan **cadangan otomatis** dari layar Cadangan: aktifkan, lalu atur berapa hari antara cadangan otomatis, berapa banyak cadangan yang disimpan (yang lebih lama dari jumlah ini dihapus otomatis), dan berapa hari tanpa cadangan yang akan memicu pengingat. Ketika diaktifkan, Sarang memeriksa saat aplikasi dimulai apakah sudah cukup hari berlalu sejak cadangan terakhir dan membuat satu secara otomatis jika demikian, dengan notifikasi yang mengonfirmasi hal itu terjadi.

Sarang juga membuat **cadangan keamanan** otomatis dari database Anda saat ini segera sebelum pemulihan apa pun dilakukan (lihat di bawah), sehingga sebuah pemulihan itu sendiri dapat dibatalkan jika diperlukan.

## Memeriksa integritas cadangan dan database

Layar Cadangan menampilkan dua indikator langsung:
- **Kesehatan cadangan** — apakah Anda terlindungi (dicadangkan hari ini), terlambat (dicadangkan dalam seminggu terakhir tetapi tidak hari ini), atau tidak terlindungi (tidak ada cadangan, atau lebih dari seminggu lalu).
- **Integritas database** — pemeriksaan bahwa file database aktif Anda tidak rusak.

Anda juga dapat mengklik ikon perisai di samping cadangan mana pun untuk **Verifikasi cadangan** sesuai permintaan — Sarang memeriksa ulang checksum file dan mengonfirmasi bahwa file tersebut masih dapat dibuka dan dibaca dengan benar, lalu memperbarui status valid/tidak validnya. Setiap cadangan di-checksum (SHA-256) saat dibuat khusus agar manipulasi atau kerusakan file di kemudian hari dapat terdeteksi.

## Memulihkan dari sebuah cadangan

Klik ikon pulihkan pada cadangan mana pun dalam daftar. Sarang terlebih dahulu memvalidasi file dan menampilkan pratinjau kepada Anda — nama bisnis, tanggal cadangan, versi aplikasi, dan ukuran database — sehingga Anda dapat memastikan Anda memulihkan yang benar. Mengonfirmasi memicu:

1. Cadangan keamanan dari database Anda *saat ini* (sehingga data hari ini tidak hilang jika Anda berubah pikiran).
2. Penggantian database aktif dengan isi cadangan.
3. Restart otomatis aplikasi untuk terhubung kembali ke data yang dipulihkan.

Pemulihan hanya tersedia bagi pengguna dengan izin yang sesuai (biasanya seorang admin). Jika pemulihan gagal di tengah jalan, Sarang mencoba terhubung kembali ke database asli Anda dan melaporkan errornya — cadangan keamanan yang dibuat pada langkah 1 ada khusus agar Anda juga bisa pulih dari situasi itu.

## Menghapus cadangan lama

Cadangan dapat dihapus satu per satu dari daftar (dibatasi admin/izin). Menghapus menghilangkan baik file maupun catatannya; tidak memengaruhi data aktif Anda.
