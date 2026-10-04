"""Create a short-lived local CA and HTTPS certificate; never change the OS trust store."""
import argparse
import ipaddress
from datetime import datetime, timedelta, timezone
from pathlib import Path
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID

parser = argparse.ArgumentParser()
parser.add_argument("ip", type=ipaddress.ip_address)
args = parser.parse_args()
if not args.ip.is_private or args.ip.is_loopback:
    parser.error("Specify the private Wi-Fi IPv4 address of this computer.")
root = Path(__file__).resolve().parent.parent
folder = root / ".phone-test"
folder.mkdir(exist_ok=True)
if (folder / "server.key").exists():
    parser.error("Certificates already exist. Reuse them, or archive .phone-test before generating new ones.")
now = datetime.now(timezone.utc)
ca_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
ca_name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "Wedding Wi-Fi test CA (7 days)")])
ca = (x509.CertificateBuilder().subject_name(ca_name).issuer_name(ca_name)
      .public_key(ca_key.public_key()).serial_number(x509.random_serial_number())
      .not_valid_before(now-timedelta(minutes=5)).not_valid_after(now+timedelta(days=7))
      .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
      .add_extension(x509.KeyUsage(digital_signature=False, content_commitment=False,
                      key_encipherment=False, data_encipherment=False, key_agreement=False,
                      key_cert_sign=True, crl_sign=True, encipher_only=False, decipher_only=False), critical=True)
      .sign(ca_key, hashes.SHA256()))
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
cert = (x509.CertificateBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, str(args.ip))]))
        .issuer_name(ca_name).public_key(key.public_key()).serial_number(x509.random_serial_number())
        .not_valid_before(now-timedelta(minutes=5)).not_valid_after(now+timedelta(days=7))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(x509.SubjectAlternativeName([x509.IPAddress(args.ip),x509.IPAddress(ipaddress.ip_address("127.0.0.1")),x509.DNSName("localhost")]), critical=False)
        .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
        .add_extension(x509.KeyUsage(digital_signature=True, content_commitment=False,
                        key_encipherment=True, data_encipherment=False, key_agreement=False,
                        key_cert_sign=False, crl_sign=False, encipher_only=False, decipher_only=False), critical=True)
        .sign(ca_key, hashes.SHA256()))
for name, data in {"server.key":key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()),
                   "server.pem":cert.public_bytes(serialization.Encoding.PEM),
                   "ca.pem":ca.public_bytes(serialization.Encoding.PEM),
                   "ca.cer":ca.public_bytes(serialization.Encoding.DER)}.items():
    target=folder/name
    target.write_bytes(data)
    target.chmod(0o600)
# No CA private key is persisted. Only the test server's key is saved locally.
print(f"Certificates created for {args.ip}; valid for 7 days. Trust ca.cer manually on test phones only.")
