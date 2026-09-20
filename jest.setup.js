// Fix for Jest worker serialization of BigInt values
BigInt.prototype.toJSON = function () {
  return this.toString();
};
