use kofft::wavelet::{
    db4_forward_multi, db4_inverse_multi, haar_forward_multi, haar_inverse_multi,
};

fn main() {
    let signal = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0];
    let (approx, details) = haar_forward_multi(&signal, 2).unwrap();
    println!("Haar approx: {:?}\nHaar details: {:?}", approx, details);
    let recon = haar_inverse_multi(&approx, &details).unwrap();
    println!("Haar recon: {:?}", recon);

    let (approx2, details2) = db4_forward_multi(&signal, 2).unwrap();
    println!("Db4 approx: {:?}\nDb4 details: {:?}", approx2, details2);
    let recon2 = db4_inverse_multi(&approx2, &details2).unwrap();
    println!("Db4 recon: {:?}", recon2);
}
