# Pengguna & Hak Akses

Jika lebih dari satu orang menggunakan Sarang — seorang pemilik ditambah kasir, staf dapur, atau manajer — tambahkan masing-masing sebagai **Pengguna** mereka sendiri dengan sebuah **Peran** yang mengontrol persis apa yang bisa mereka lihat dan lakukan. Ini dikelola dari **Settings → Users & Roles**.

## Menambahkan seorang pengguna

Klik **Tambah Pengguna** dan isi:

- **Nama Lengkap** (wajib)
- **Nama Pengguna** (wajib — digunakan untuk masuk)
- **Kata Sandi** (wajib, panjang minimum ditetapkan oleh Kebijakan Kata Sandi Anda, minimal 6 karakter)
- **Peran** (wajib — lihat di bawah)
- **Email** dan **Telepon** (opsional)

Simpan, dan akun baru tersebut dapat langsung masuk dengan nama pengguna dan kata sandi yang Anda tetapkan.

## Peran

Setiap pengguna diberi satu peran, dan setiap peran hadir dengan seperangkat izin tetap yang sudah dibangun ke dalam Sarang — tidak ada layar untuk membuat peran khusus atau memilih izin satu per satu secara manual. Peran bawaan adalah:

- **Admin** — akses sistem penuh, termasuk setiap pengaturan, setiap laporan, dan manajemen pengguna itu sendiri.
- **Manager** — kontrol operasional luas (penagihan, inventaris, pembelian, laporan, sebagian besar pengaturan) tanpa akses tingkat admin penuh.
- **Cashier** — berfokus pada penagihan: membuat faktur, mencatat pembayaran, dan operasi konter sehari-hari yang relevan dengan jenis bisnis Anda.
- **Staff** — dukungan operasional umum dengan akses yang lebih sempit daripada Cashier/Manager.
- **Kitchen Staff** — dibatasi untuk operasi dapur restoran (melihat/memperbarui KOT), untuk bisnis yang menggunakan template Restaurant.

Setiap layar dan tindakan di Sarang memeriksa izin peran pengguna saat ini sebelum mengizinkannya — misalnya, bagian Users & Roles itu sendiri hanya terlihat oleh pengguna yang perannya memiliki izin `users.view`, dan membuat, mengedit, atau menonaktifkan pengguna lain masing-masing memerlukan izin terpisahnya sendiri. Jika peran Anda tidak memiliki akses ke sesuatu, opsi tersebut disembunyikan atau ditampilkan nonaktif.

## Mengedit seorang pengguna atau mengubah perannya

Klik ikon edit (pensil) di samping seorang pengguna untuk mengubah nama lengkap, peran, email, atau telepon mereka. Nama pengguna dan kata sandi tidak diubah dari formulir ini — lihat reset kata sandi di bawah.

## Menonaktifkan seorang pengguna

Klik ikon hapus di samping pengguna aktif untuk menonaktifkan mereka (memerlukan izin nonaktifkan). Akun yang dinonaktifkan tidak dapat lagi masuk, tetapi catatan historisnya (faktur yang dibuat, tindakan yang dicatat, dll.) tetap dipertahankan. Anda tidak dapat menonaktifkan akun Anda sendiri dari layar ini.

## Mereset kata sandi pengguna lain

Klik ikon perisai di samping seorang pengguna (tidak tersedia untuk akun Anda sendiri) untuk menetapkan kata sandi baru bagi mereka secara langsung — berguna jika mereka lupa kata sandinya. Ini langsung membatalkan sesi login mereka yang ada.

## Mengubah kata sandi Anda sendiri

Buka **Settings → Security**, masukkan kata sandi Anda saat ini, lalu kata sandi baru Anda dua kali. Kata sandi baru Anda harus memenuhi panjang minimum yang dikonfigurasi (10 karakter secara default). Setelah perubahan berhasil, Anda perlu masuk kembali.

## Kebijakan kata sandi

Juga di bawah **Settings → Security**, seorang admin dapat menetapkan **panjang kata sandi minimum** yang diwajibkan untuk setiap akun ke depannya (antara 4 dan 64 karakter). Ini hanya berlaku pada saat berikutnya sebuah kata sandi dibuat atau diubah — kata sandi yang sudah ada tidak terpengaruh secara retroaktif.

## Batas waktu sesi

Untuk keamanan, Sarang secara otomatis mengeluarkan sesi yang tidak aktif setelah periode ketidakaktifan (30 menit secara default) — klik mouse, tekan tombol, gulir, atau sentuhan apa pun mengatur ulang penghitung waktu. Ini melindungi dari seseorang yang meninggalkan kasir atau komputer kantor yang tidak terkunci. Masuk kembali cukup memerlukan nama pengguna dan kata sandi Anda lagi; tidak ada pekerjaan yang sedang berlangsung yang hilang selain yang belum sempat disimpan.

## Perlindungan login

Setelah 5 kali percobaan login gagal untuk nama pengguna yang sama dalam 15 menit, Sarang memblokir sementara percobaan lebih lanjut dan memberi tahu Anda berapa menit harus menunggu — ini berlaku baik untuk masuk maupun mengubah kata sandi Anda sendiri, untuk memperlambat siapa pun yang mencoba menebak kata sandi.
