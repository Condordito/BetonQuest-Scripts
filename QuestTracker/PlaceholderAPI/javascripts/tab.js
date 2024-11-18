var tabPlugin = BukkitServer.pluginManager.getPlugin("TAB")
var loader = tabPlugin.class.classLoader

var Arrays = loader.loadClass("java.util.Arrays").static
var JString = loader.loadClass("java.lang.String").static
var TabAPI = loader.loadClass("me.neznamy.tab.api.TabAPI").static

var scbManager = TabAPI.instance.scoreboardManager
var player = TabAPI.instance.getPlayer(Player.uniqueId)

function main() {
  var command = (args[0] || "").toUpperCase()
  switch (command) {
    case "SET":
      var input = JString.join(",", Arrays.copyOfRange(args, 2, args.length))
      var result = input.replace(/#|\[|\]|<@rb>|<@lb>|<@nm>/g, function (match) {
        switch (match) {
            case "#": return "%";
            case "[": return "{";
            case "]": return "}";
            case "<@rb>": return "]";
            case "<@lb>": return "[";
            case "<@nm>": return "#";
        }
      }).split(/\n|\\n/)
      return setScoreboard(args[1], result)
    case "RESET": 
      scbManager.resetScoreboard(player)
      return true
    default: 
      return `Unknown command: ${command}`
  }
}

function setScoreboard(title, lines) {
  scoreboard = scbManager.createScoreboard("quests", title, lines)
  scbManager.showScoreboard(player, scoreboard)
  return true
}

main()
