var papi = Expansion.getPlaceholderAPI()
var loader = papi.class.classLoader

var BarColor = loader.loadClass("org.bukkit.boss.BarColor").static
var BarStyle = loader.loadClass("org.bukkit.boss.BarStyle").static
var BarFlag = loader.loadClass("org.bukkit.boss.BarFlag").static
var Location = loader.loadClass("org.bukkit.Location").static
var Particle = loader.loadClass("org.bukkit.Particle").static
var Vector = loader.loadClass("org.bukkit.util.Vector").static
var BukkitRunnable = loader.loadClass("org.bukkit.scheduler.BukkitRunnable").static
var FixedMetadataValue = loader.loadClass("org.bukkit.metadata.FixedMetadataValue").static

var BAR_COLOR = BarColor.RED // BLUE, GREEN, PINK, PURPLE, RED, WHITE, YELLOW
var BAR_STYLE = BarStyle.SEGMENTED_20 // SEGMENTED_10, SEGMENTED_12, SEGMENTED_20, SEGMENTED_6, SOLID
var BAR_FLAGS = [ BarFlag.DARKEN_SKY ] // CREATE_FOG, DARKEN_SKY, PLAY_BOSS_MUSIC

var DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
var SEPARATOR = "§f§m ", TARGET = '§c§l⬤', TARGET_ABOVE = '§c§l⬆', TARGET_BELOW = '§c§l⬇';
var COMPASS_LENGTH = 40, SEPARATOR_DISTANCE = 10, TARGET_OFFSET = 2, DISTANCE_LIMIT = 50, MIN_VISIBILITY_DISTANCE = 5
var BAR_METADATA_KEY = "BQ_QUEST_GPS_TRACKER", TASK_METADATA_KEY = "BQ_QUEST_GPS_TRACKER_TASK"
var TASK_DELAY = 0, TASK_PERIOD = 3

var COMPASS_TEXT = DIRECTIONS
  .reduce((arr, curr, index) => {
    arr.push(`§a§l${curr}`)
    for (var i = 0; i < SEPARATOR_DISTANCE; i++) 
      arr.push(SEPARATOR)
    return arr
  }, [])


function main() {
  var command = (args[0] || "").toUpperCase()
  switch(command) {
    case "SET":
      resetGps()
      return createGps()
    case "RESET":
      return resetGps()
    default: 
      return `Unknown command: ${command}`
  }
}

function createGps() {
  var bossBar = BukkitServer.createBossBar("", BAR_COLOR, BAR_STYLE, BAR_FLAGS)
  var location = new Location(BukkitServer.getWorld(args[1]), +args[2], +args[3], +args[4])
  var data = { maxDistance = 10, target = location }
  bossBar.addPlayer(Player)

  var task = new BukkitRunnable(function() {
    if (!Player.isOnline()) return resetGps()
    updateGps(bossBar, data)
  })

  Player.setMetadata(BAR_METADATA_KEY, new FixedMetadataValue(papi, bossBar))
  Player.setMetadata(TASK_METADATA_KEY, new FixedMetadataValue(papi, task))
  task.runTaskTimer(papi, TASK_DELAY, TASK_PERIOD)

  return true
}

function resetGps() {
  if (!Player.hasMetadata(BAR_METADATA_KEY)) return false
  var bossBar = Player.getMetadata(BAR_METADATA_KEY)[0].value()
  var task = Player.getMetadata(TASK_METADATA_KEY)[0].value()
  Player.removeMetadata(BAR_METADATA_KEY, papi)
  Player.removeMetadata(TASK_METADATA_KEY, papi)
  bossBar.removeAll()
  task.cancel()
  return true
}

function updateGps(bossBar, data) {
  var distance = getDistance(data)
  bossBar.setVisible(distance > MIN_VISIBILITY_DISTANCE)
  if (!bossBar.isVisible()) return false

  var isTargetable = distance != Number.MAX_VALUE
  bossBar.setTitle(getGpsText(data.target, isTargetable))

  var mapped = map(Math.min(distance, data.maxDistance), 
    MIN_VISIBILITY_DISTANCE, data.maxDistance, 0.0, 1.0)

  bossBar.setProgress(mapped)
  return true
}

function getGpsText(target, isTargetable) {
  var source = Player.getEyeLocation()
  var yaw = Math.floor(mod(source.getYaw() - 180, 360)), output = []

  var startingIndex = getIndex(yaw)
  for (var i = 0; i < COMPASS_TEXT.length; i++) {
    var index = mod(startingIndex++, COMPASS_TEXT.length)
    output.push(COMPASS_TEXT[index])
  }
  
  if (isTargetable) setGpsTarget(output, source, target, yaw)
  
  if (output.length > COMPASS_LENGTH) {
    var offset = Math.floor((output.length - COMPASS_LENGTH) / 2)
    output = output.slice(offset, output.length - offset)
  }
  return output.join("")
}

function setGpsTarget(output, source, target, yaw) {
  var origin = new Vector(0, 0, -1)
  var direction = target.clone().subtract(source).toVector().normalize().setY(0)
  var angleToTarget = Math.floor(origin.angle(direction) / Math.PI * 180.0)
  angleToTarget *= direction.crossProduct(origin).getY() > 0 ? 1 : -1;
  var targetIndex = getIndex(mod(angleToTarget - yaw, 360))
  var altitude = source.getBlockY() - target.getBlockY()
  output[targetIndex] = getTargetIcon(altitude)
}

function getDistance(data) {
  var source = Player.getEyeLocation()
  if (source.world != data.target.world) return Number.MAX_VALUE
  var distance = source.distance(data.target)
  if (distance > data.maxDistance)
    data.maxDistance = Math.min(distance, DISTANCE_LIMIT)
  return distance
}

function getTargetIcon(altitude) {
  if (Math.abs(altitude) <= TARGET_OFFSET) return TARGET
  if (altitude < 0) return TARGET_ABOVE
  return TARGET_BELOW
}

function getIndex(angle) {
  var index = map(angle, 0, 360, 0, COMPASS_TEXT.length)
  return Math.floor(mod(index - (COMPASS_TEXT.length / 2), COMPASS_TEXT.length))
}

function mod(number, max) {
  var result = number - (max * Math.floor(number / max));
  return result < 0 ? result + max : result;
}

function map(value, in_min, in_max, out_min, out_max) {
  return (value - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

main()