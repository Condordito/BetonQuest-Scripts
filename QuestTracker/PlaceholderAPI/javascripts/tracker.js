var papi = Expansion.getPlaceholderAPI()
var loader = papi.class.classLoader

var ArrayList = loader.loadClass("java.util.ArrayList").static
var HashMap = loader.loadClass("java.util.HashMap").static
var Arrays = loader.loadClass("java.util.Arrays").static
var JString = loader.loadClass("java.lang.String").static
var MemorySection = loader.loadClass("org.bukkit.configuration.MemorySection").static

var uuid = BukkitPlayer.uniqueId

// SEND/SHOW (id) | Sends an entry checking first if new entries are allowed
// HAS/CONTAINS/INCLUDES (id) | Checks if an entry is registered
// IS_ACTIVE (id) | Checks if the current is entry matches the given id
// SET_LOC/ADD_LOC (id, world, x, y, z) 
// SET_SCB/ADD_SCB (id, title, lines)
// REMOVE/DELETE (id) | Removes a given entry by id
// TOGGLE (id) / Toggles a particular entry
// CYCLE (id) / Cycles between non hidden entries
// RESET (id) / Removes all entries

function main() {
  var success = false
  var command = (args[0] || "").toUpperCase()
  switch (command) {
    case "LOAD":
    case "CHECK":
      return checkCurrentEntry()
    case "SEND":
    case "SHOW":
      success = sendEntry(args[1])
      break
    case "SCOREBOARD":
    case "TAB":
    case "SCB":
      var lines = JString.join(",", Arrays.copyOfRange(args, 3, args.length)).split(/\n|\\n/)
      success = setEntryScoreboard(args[1], args[2], lines)
      break
    case "LOCATION":
    case "GPS":
    case "LOC":
      success = setEntryLocation(args[1], args[2], +args[3], +args[4], +args[5])
      break
    case "INCLUDES":
    case "CONTAINS":
    case "HAS":
      return Data.exists(`${uuid}.entries.${args[1]}`)
    case "ACTIVE":
      if(!args[1]) return false
      return Data.get(`${uuid}.current`) == args[1]
    case "REMOVE":
    case "DELETE":
      success = removeEntry(args[1])
      break
    case "TOGGLE": 
      success = toggleEntry(args[1])
      if (success)
      break
    case "CYCLE":
      success = cycleEntry(+args[1])
      break
    case "RESET": 
      success = resetData()
      break
    default: 
      return `Unknown command: ${command}`
  }
  if (success) Placeholder.saveData()
  return success
}

function checkCurrentEntry() {
  var current = Data.get(`${uuid}.current`);
  if (!current) return true
  var entryPath = `${uuid}.entries.${current}`
  return displayEntry(current, DataVar.get(`${uuid}.entries`))
}

function sendEntry(id) {
  var hasEntry = Data.exists(`${uuid}.entries.${id}`);
  var isHidden = Data.exists(`${uuid}.hidden_entries.${id}`)
  if (!hasEntry || isCurrent(id) || isHidden) return false
  return displayEntry(id, DataVar.get(`${uuid}.entries`))
}

function setEntryScoreboard(id, title, lines) {
  var entryPath = `${uuid}.entries.${id}`;
  var entry = handleSection(DataVar.getOrDefault(entryPath, new HashMap()))
  entry.putAll({ title, lines: new ArrayList(lines) })
  Data.set(entryPath, entry);
  if (!isCurrent(id)) return true
  Data.set(`${uuid}.current`, id)
  return displayScoreboard(entry.title, entry.lines)
}

function setEntryLocation(id, world, x, y, z) {
  var entryPath = `${uuid}.entries.${id}`;
  var entry = handleSection(DataVar.getOrDefault(entryPath, new HashMap()))
  entry.location = { world, x, y, z }
  // TODO: save it as a location instead
  Data.set(entryPath, entry);
  if (!isCurrent(id)) return true
  Data.set(`${uuid}.current`, id)
  return displayLocation(entry.location)
}

function toggleEntry(id) {
  var entries = DataVar.get(`${uuid}.entries`)
  if (entries == null || entries.get(id) == null) return false
  
  var hidden = DataVar.getOrDefault(`${uuid}.hidden_entries`, new ArrayList())
  var current = DataVar.get(`${uuid}.current`)

  if (current == id && !hidden.contains(current)) {
    hidden.add(id)
    Data.set(`${uuid}.hidden_entries`, hidden)
    var nextKey = getNextEntryKey(current, entries, hidden)
    return handleEntryKey(nextKey)
  }

  hidden.remove(id)
  Data.set(`${uuid}.hidden_entries`, hidden)
  return displayEntry(id, entries) 
}

function removeEntry(id) {
  var entries = Data.get(`${uuid}.entries`)
  if (entries == null || entries.get(id) == null) return false

  var hidden = DataVar.getOrDefault(`${uuid}.hidden_entries`, new ArrayList())
  if (hidden.remove(id)) Data.set(`${uuid}.hidden_entries`, hidden)
  entries.set(id, null)
 
  if (entries.getKeys(false).size() == 0) return resetData()

  var current = Data.get(`${uuid}.current`)
  var nextKey = getNextEntryKey(current, entries, hidden)
  return handleEntryKey(nextKey)
}

function cycleEntry(amount) {
  var keys = getAllowedEntryKeys()
  if (keys.size() == 0) return false
  var index = keys.indexOf(Data.get(`${uuid}.current`))
  index = mod(index + amount, keys.length)
  var current = keys.get(index)
  return displayEntry(current, DataVar.get(`${uuid}.entries`), keys)
}

function resetData() {
  parse([ "tab_reset", "gps_reset" ] );
  Data.remove(uuid)
  return true
}

function displayEntry(id, entries, keys) {
  var entry = handleSection(entries.get(id))
  // TODO: Use entry keys instead of re-parsing its arguments
  displayScoreboard(entry.title, entry.lines, keys)
  displayLocation(handleSection(entry.location))
  Data.set(`${uuid}.current`, id)
  return true
}

function displayScoreboard(title, lines, keys) {
  if (title == null || lines == null) return parse([ "tab_reset" ])
  if (!keys) keys = getAllowedEntryKeys()
  var currentPage = keys.indexOf(Data.get(`${uuid}.current`)) + 1
  if (keys.size() > 1) title += ` &7(${currentPage}/${keys.length})`
  var joined = JString.join("\n", lines)
  parse([ `tab_set,${title},${joined}` ])
}

function displayLocation(location) {
  if (location == null) return parse([ "gps_reset" ])
  var x = location.x, y = location.y, z = location.z
  parse([ `gps_set,${location.world},${x},${y},${z}` ])
}

function getAllowedEntryKeys() {
  var keys = new ArrayList()
  var entries = Data.get(`${uuid}.entries`)
  if (entries == null) return keys
  keys.addAll(entries.getKeys(false))
  var hidden = DataVar.get(`${uuid}.hidden_entries`)
  if (hidden == null) return keys
  keys.removeIf(function(key) { return hidden.contains(key) })
  return keys
}

function getNextEntryKey(current, entries, hidden) {
  var keys = new ArrayList(entries.getKeys(false))
  var index = mod(keys.indexOf(current), keys.length)
  for (var key of keys) {
    var option = keys.get(index)
    if (!hidden.contains(option)) return option
    index = mod(index - 1, keys.length)
  }
  return null
}

function handleSection(section) {
  return section instanceof MemorySection ? section.getValues(false) : section
}

function handleEntryKey(key) {
  if (key != null) return displayEntry(key, DataVar.get(`${uuid}.entries`))
  parse([ "tab_reset", "gps_reset" ] );
  Data.remove(`${uuid}.current`)
  return true
}

function isCurrent(id) {
  var current = Data.get(`${uuid}.current`);
  return current != null && current == id
}

function parse(inputs) {
  for (var input of inputs) {
    var placeholder = `javascript_${input}`
    PlaceholderAPI.static.setPlaceholders(BukkitPlayer, "%" + placeholder + "%");    
  }
}

function mod(number, max) {
  var result = number - (max * Math.floor(number / max));
  return result < 0 ? result + max : result;
}

main()
