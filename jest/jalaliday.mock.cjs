/** Jest stub: jalali calendar ≈ local gregorian day (enough for unit tests). */
module.exports = function jalalidayMock(_options, Dayjs) {
  const proto = Dayjs.prototype;
  proto.calendar = function calendar(name) {
    if (name === 'jalali') {
      const inst = this.clone();
      inst.$jalali = true;
      return inst;
    }
    return this;
  };
  const origFormat = proto.format;
  proto.format = function format(template) {
    if (this.$jalali && template === 'YYYY-MM-DD') {
      const d = this.toDate();
      const pad = n => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
    return origFormat.call(this, template);
  };
};
