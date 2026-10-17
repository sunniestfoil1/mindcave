// java.util.Random (LCG de 48 bits) em aritmética de Number (duas metades de 24 bits): idêntico ao do Java e sem BigInt no caminho quente.
// A geração de mundo do 1.8.9 depende da sequência exata de números, então aqui nada é "parecido": é o mesmo algoritmo.
const AH = 0x5de, AL = 0xece66d;           // multiplicador 0x5DEECE66D = AH·2²⁴ + AL
const M24 = 16777216;
const MASK48 = (1n << 48n) - 1n;

export class JRandom {
  constructor(seed = BigInt(Date.now())) { this.hi = 0; this.lo = 0; this.setSeed(seed); this._haveG = false; }

  // seed: BigInt (long do Java) ou Number inteiro
  setSeed(seed) {
    const s = (BigInt.asIntN(64, BigInt(seed)) ^ 0x5deece66dn) & MASK48;
    this.hi = Number(s >> 24n);
    this.lo = Number(s & 0xffffffn);
    this._haveG = false;
  }

  next(bits) {
    const l = this.lo * AL + 0xb;
    const carry = Math.floor(l / M24);
    const h = this.hi * AL + this.lo * AH + carry;
    this.lo = l - carry * M24;
    this.hi = h % M24;
    // (int)(seed >>> (48 - bits))
    const v = Math.floor((this.hi * M24 + this.lo) / Math.pow(2, 48 - bits));
    return bits === 32 ? v | 0 : v;
  }

  nextInt(bound) {
    if (bound === undefined) return this.next(32);
    if ((bound & -bound) === bound) return Math.floor((bound * this.next(31)) / 2147483648);
    let bits, val;
    do {
      bits = this.next(31);
      val = bits % bound;
    } while (((bits - val + (bound - 1)) | 0) < 0);
    return val;
  }

  nextLong() { return (BigInt(this.next(32)) << 32n) + BigInt(this.next(32)); }   // BigInt com sinal de 64 bits
  nextBoolean() { return this.next(1) !== 0; }
  nextFloat() { return this.next(24) / 16777216; }
  nextDouble() { return (this.next(26) * 134217728 + this.next(27)) / 9007199254740992; }
  nextGaussian() {
    if (this._haveG) { this._haveG = false; return this._g; }
    let v1, v2, s;
    do {
      v1 = 2 * this.nextDouble() - 1;
      v2 = 2 * this.nextDouble() - 1;
      s = v1 * v1 + v2 * v2;
    } while (s >= 1 || s === 0);
    const mul = Math.sqrt(-2 * Math.log(s) / s);
    this._g = v2 * mul; this._haveG = true;
    return v1 * mul;
  }
}
