const crypto = require('crypto');
const bigInt = require('big-integer');

function serializeString(bytes) {
    let res = Buffer.alloc(0);
    if (bytes.length < 254) {
        res = Buffer.concat([Buffer.from([bytes.length]), bytes]);
    } else {
        const lenBuffer = Buffer.alloc(4);
        lenBuffer.writeUInt32LE(bytes.length, 0);
        res = Buffer.concat([Buffer.from([254]), lenBuffer.slice(0, 3), bytes]);
    }
    const padding = (4 - (res.length % 4)) % 4;
    if (padding > 0) {
        res = Buffer.concat([res, Buffer.alloc(padding)]);
    }
    return res;
}

function computeFingerprint(pem) {
    const key = crypto.createPublicKey({ key: pem, format: 'pem', type: 'pkcs1' });
    const jwk = key.export({ format: 'jwk' });
    
    let nBuffer = Buffer.from(jwk.n, 'base64url');
    let eBuffer = Buffer.from(jwk.e, 'base64url');
    
    if (nBuffer[0] & 0x80) {
        nBuffer = Buffer.concat([Buffer.from([0x00]), nBuffer]);
    }
    if (eBuffer[0] & 0x80) {
        eBuffer = Buffer.concat([Buffer.from([0x00]), eBuffer]);
    }

    const constructorId = Buffer.alloc(4);
    constructorId.writeUInt32LE(0x7a19cb76, 0);

    const serializedN = serializeString(nBuffer);
    const serializedE = serializeString(eBuffer);

    const data = Buffer.concat([constructorId, serializedN, serializedE]);
    
    const sha1 = crypto.createHash('sha1').update(data).digest();
    
    const fingerprintBytes = sha1.slice(sha1.length - 8);
    
    const fingerprintLE = fingerprintBytes.readBigInt64LE(0);
    const fingerprintBE = fingerprintBytes.readBigInt64BE(0);
    
    return {
        fingerprintLE: fingerprintLE.toString(),
        fingerprintBE: fingerprintBE.toString(),
        n: bigInt(nBuffer.toString('hex'), 16).toString(),
        e: bigInt(eBuffer.toString('hex'), 16).toString()
    };
}

const pem = `-----BEGIN RSA PUBLIC KEY-----
MIIBCgKCAQEA6LszBcC1LGzyr992NzE0ieY+BSaOW622Aa9Bd4ZHLl+TuFQ4lo4g
5nKaMBwK/BIb9xUfg0Q29/2mgIR6Zr9krM7HjuIcCzFvDtr+L0GQjae9H0pRB2OO
62cECs5HKhT5DZ98K33vmWiLowc621dQuwKWSQKjWf50XYFw42h21P2KXUGyp2y/
+aEyZ+uVgLLQbRA1dEjSDZ2iGRy12Mk5gpYc397aYp438fsJoHIgJ2lgMv5h7WY9
t6N/byY9Nw9p21Og3AoXSL2q/2IJ1WRUhebgAdGVMlV1fkuOQoEzR7EdpqtQD9Cs
5+bfo3Nhmcyvk5ftB0WkJ9z6bNZ7yxrP8wIDAQAB
-----END RSA PUBLIC KEY-----`;

console.log(computeFingerprint(pem));
