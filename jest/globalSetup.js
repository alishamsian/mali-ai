// Day-bucketing tests assume Iran time (the app's users), independent of the machine's zone.
// Set before workers start: Node fixes the zone at the first Date call in a process.
module.exports = async () => {
  process.env.TZ = 'Asia/Tehran';
};
