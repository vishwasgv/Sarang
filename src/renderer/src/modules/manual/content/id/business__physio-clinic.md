# Klinik Fisioterapi

Layar jenis bisnis ini hanya dalam bahasa Inggris, terlepas dari pengaturan bahasa Anda di tempat lain di Sarang.

## Fondasi layanan bersama

Setiap jenis bisnis berbasis layanan di Sarang — termasuk Klinik Fisioterapi — dimulai dari empat blok bangunan yang sama: **Janji Temu** (memesan dan menjadwalkan kunjungan), sebuah **Katalog Layanan** (daftar sesi terapi dan harganya), **Provider Schedules** (fisioterapis mana yang tersedia kapan), dan sebuah **Notification Queue** otomatis yang menangani pengingat tanpa Anda harus mengirimnya secara manual. Sisa bab ini membahas apa yang spesifik untuk fisioterapi: catatan konsultasi dengan penilaian nyeri, fase perawatan, program latihan rumah, dan paket sesi.

## Consultation Notes

Membuka **Consultation Note** sebuah janji temu memberi Anda catatan SOAP terstruktur yang sama yang digunakan di seluruh jenis bisnis klinis Sarang (lihat bab *Klinik Dokter Umum* untuk field dasar), ditambah dua tambahan khusus-fisio:

- **Pain Score** — skala 0 (tidak ada) hingga 10 (terburuk), dimasukkan baik sebagai angka atau dengan mengetuk tombol pilihan cepat.
- **Functional Score** — skala 0-100 (lebih tinggi = fungsi lebih baik), melacak seberapa baik pasien benar-benar dapat bergerak dan melakukan tugas, bersamaan dengan nyeri.
- **Treatment Given This Session** — teks bebas yang menjelaskan apa yang sebenarnya dilakukan dalam sesi tersebut (misalnya terapi ultrasound, TENS, terapi manual, taping).

Setelah seorang pasien memiliki dua sesi atau lebih tercatat, sebuah grafik **Vitals Trend** muncul pada catatannya — beralih antara chip Pain Score dan Functional Score untuk melihat salah satunya diplot dari waktu ke waktu, sehingga Anda dan pasien dapat melihat kemajuan sungguhan (atau ketiadaannya) sekilas alih-alih membolak-balik catatan lama.

## Treatment Phases

Setiap profil pasien fisio memiliki tab **Treatment** yang melacak perjalanan rehabilitasinya melalui fase bernama: Initial Assessment, Acute Phase, Sub-Acute, Active Rehabilitation, Maintenance, dan Discharge. Setiap fase mencatat judul, tanggal mulai, tujuan, dan — setelah Anda menutupnya — catatan hasil. Hanya satu fase yang terbuka ("aktif") pada satu waktu; menutup satu memungkinkan Anda memulai yang berikutnya, membangun linimasa yang jelas tentang bagaimana pasien berkembang.

## Home Exercise Program (HEP)

Tab **Exercise Program** memungkinkan Anda membangun Home Exercise Program yang dapat dicetak untuk pasien: daftar bernomor latihan, masing-masing dengan nama, deskripsi cara melakukannya, dan set/repetisi/waktu-tahan/frekuensi. **Print HEP** menghasilkan selebaran terformat dengan kop surat klinik dan garis tanda tangan, dan mencatat kapan terakhir dicetak.

## Session Packs

Tab **Paket Sesi** melacak bundel sesi yang dibayar di muka (misalnya "Paket Fisio 10-sesi"): nama paket, total sesi, harga, tarif GST, tanggal pembelian dan kedaluwarsa. Sebuah paket aktif menampilkan progress bar sesi yang tersisa, dan setiap janji temu selesai terhadap paket tersebut mengurangi satu sesi secara otomatis. Setelah sebuah paket memiliki harga, Anda dapat **Buat Faktur** untuknya langsung dari layar ini — ini hanya menawarkan sekali, dan menandai paket "Invoiced" sesudahnya sehingga tidak pernah ditagih dua kali.

Baris filter di bagian atas daftar Paket Sesi (**Semua / Aktif / Menipis / Kedaluwarsa**, masing-masing dengan hitungan langsung) adalah tampilan peringatan Anda: sebuah paket masuk ke **Menipis** begitu tersisa 2 sesi atau kurang, dan ke **Kedaluwarsa** begitu tanggal kedaluwarsanya terlewati — keduanya juga ditandai dengan warna pada kartu paket itu sendiri, sehingga Anda tidak perlu membuka paket untuk menyadari bahwa itu perlu perhatian.

Untuk melihat bagaimana paket sesi Anda digunakan di seluruh pasien, buka **Reports → Pack Utilization** dan pilih rentang tanggal. Ini menampilkan total paket terjual, sesi terpakai dibandingkan sesi dibeli, dan persentase penggunaan keseluruhan, ditambah grafik batang dan tabel lengkap yang merinci per paket — sehingga Anda dapat melihat sekilas paket yang sebagian besar belum terpakai (tanda untuk menindaklanjuti dengan pasien tersebut).

## Rujukan

Jika seorang pasien datang dirujuk oleh dokter luar, bagian **Detail Rujukan** pada Catatan Konsultasi mencatat siapa yang merujuk, tanggalnya, dan alasannya — kolom teks bebas, karena dokter yang merujuk biasanya sepenuhnya di luar Sarang. Jika sebaliknya Anda mengarahkan pasien ke penyedia lain di dalam klinik Anda sendiri, gunakan **Rujuk ke Penyedia Lain** pada catatan pasien tersebut untuk memesan janji temu tertaut yang sesungguhnya, mekanisme rujukan dalam-aplikasi yang sama yang digunakan di seluruh jenis bisnis klinis Sarang.

Setelah penyedia tersebut menyelesaikan catatannya sendiri pada janji temu rujukan, hasilnya muncul kembali secara otomatis pada catatan asli Anda. Jika catatan itu melacak Skor Nyeri dan Skor Fungsional sepanjang sesi, hasil yang ditampilkan bukan sekadar komentar penutupnya — melainkan perbandingan sebelum-dan-sesudah yang terukur di seluruh perjalanan pengobatan sejak rujukan (misalnya, "Nyeri 7→3, Fungsi 40→75 selama 3 sesi"), sehingga Anda dapat melihat sekilas apakah rujukan itu benar-benar membantu, bukan sekadar bahwa itu terjadi.
