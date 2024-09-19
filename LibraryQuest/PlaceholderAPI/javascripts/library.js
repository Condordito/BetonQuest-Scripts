var papi = Expansion.getPlaceholderAPI()
var loader = papi.class.classLoader

var Metadata = loader.loadClass("me.arasple.mc.trmenu.module.internal.data.Metadata").static
var FixedMetadataValue = loader.loadClass("org.bukkit.metadata.FixedMetadataValue").static
var ItemStack = loader.loadClass("org.bukkit.inventory.ItemStack").static
var Material = loader.loadClass("org.bukkit.Material").static
var ChatColor = loader.loadClass("org.bukkit.ChatColor").static

var PlainTextComponentSerializer = loader.loadClass("net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer").static
var JSONComponentSerializer = loader.loadClass("net.kyori.adventure.text.serializer.json.JSONComponentSerializer").static

var HttpClients = loader.loadClass("org.apache.http.impl.client.HttpClients").static
var RequestConfig = loader.loadClass("org.apache.http.client.config.RequestConfig").static
var CookieSpecs = loader.loadClass("org.apache.http.client.config.CookieSpecs").static
var StringEntity = loader.loadClass("org.apache.http.entity.StringEntity").static
var HttpPost = loader.loadClass("org.apache.http.client.methods.HttpPost").static
var EntityUtils = loader.loadClass("org.apache.http.util.EntityUtils").static

var ArrayList = loader.loadClass("java.util.ArrayList").static
var CompletableFuture = loader.loadClass("java.util.concurrent.CompletableFuture").static
var Collectors = loader.loadClass("java.util.stream.Collectors").static
var UUID = loader.loadClass("java.util.UUID").static

var PlayerConverter = loader.loadClass("org.betonquest.betonquest.utils.PlayerConverter").static;
var ObjectiveID = loader.loadClass("org.betonquest.betonquest.id.ObjectiveID").static;
var BetonQuest = loader.loadClass("org.betonquest.betonquest.BetonQuest").static
var EventID = loader.loadClass("org.betonquest.betonquest.id.EventID").static
var PlayerData = loader.loadClass("org.betonquest.betonquest.database.PlayerData").static

var GROQ_API_TOKEN = "MC@f5PttjGj_G0c~3GrxG8+Nl:a)bwu_iUxMg'}a"
var SAPPLING_API_TOKEN = "MC@f5PttjGj_G0c~3GrxG8+Nl:a)bwu_iUxMg'}a"
var REQUEST_METADATA_KEY = "BQ_QUEST_REQUEST_FLAG";
var ESCAPE_REGEX = /"|\n|\s{2,}/g

var SUBMISSION_OBJ_ID = new ObjectiveID(null, "Eleanor.submission")
var MAX_PAGE_SIZE = 2, MAX_SIZE_PER_PAGE = 150
var THIRD_PARTY_VALIDATION = false

var ASYNC_MESSAGES = {
  VALID_INPUT: "Valid input",
  INVALID_TOPIC: "Invalid topic",
  IMPROPER_TITLE: "Inappropriate title" ,
  IMPROPER_CONTENT: "Inappropriate content"
}

var SYNC_MESSAGES = {
  NULL_TOPIC: "Topic not specified!",
  INVALID_ITEM: "Not a written book!",
  INVALID_PAGE_SIZE: `Number of pages is less then the minimum requirement (${MAX_PAGE_SIZE})`,
  INVALID_SIZE_PER_PAGE: `Page size is less than the minimum requirement (${MAX_SIZE_PER_PAGE})`,
  REQUEST_ALREADY_SUBMITTED: "Can not make the same request twice",
  DISABLED_SUBMISSIONS: "Submissions are disabled"
}

var BETON_INSTANCE = BetonQuest.getInstance();

function main() {
  var command = (args[0] || "").toUpperCase()
  switch (command) {
    case "ADD":
    case "CREATE":
      return addBookToLibrary(args[1])
    case "RESET": 
      // TODO: Add reset per player...
      Metadata.globalData.set("library", null)
      return true
    case "SEND":
    case "SHOW":
      return showBook(args[1], args[2])
    case "SIZE":
      var data = Metadata.globalData.get("library")
      return data == null ? 0 : data.getValues(false).size()
    default: 
      return `Unknown command: ${command}`
  }
}

function addBookToLibrary(topic) {
  if (topic == null) 
    return SYNC_MESSAGES.NULL_TOPIC

  if (THIRD_PARTY_VALIDATION && Player.hasMetadata(REQUEST_METADATA_KEY)) 
    return SYNC_MESSAGES.REQUEST_ALREADY_SUBMITTED

  var objective = BETON_INSTANCE.getObjective(SUBMISSION_OBJ_ID)
  var profile = PlayerConverter.getID(BukkitPlayer);
  if (!objective.containsPlayer(profile)) 
    return SYNC_MESSAGES.DISABLED_SUBMISSIONS

  objective.cancelObjectiveForPlayer(profile)
  var playerData = BETON_INSTANCE.getPlayerData(profile)
  playerData.removeRawObjective(SUBMISSION_OBJ_ID)

  var original = BukkitPlayer.getInventory().getItemInMainHand()
  var stack = original.clone(), meta = stack.itemMeta
  if (stack.type.toString() != "WRITTEN_BOOK") 
    return enableRetry(playerData, profile, SYNC_MESSAGES.INVALID_ITEM, SUBMISSION_OBJ_ID)

  meta.pages = meta.pages.stream().map(stripColor).collect(Collectors.toList());

  if (meta.pages.size() < MAX_PAGE_SIZE) 
    return SYNC_MESSAGES.INVALID_PAGE_SIZE
  if (meta.pages.stream().anyMatch(e => e.length < MAX_SIZE_PER_PAGE))
    return SYNC_MESSAGES.INVALID_SIZE_PER_PAGE

  if (THIRD_PARTY_VALIDATION) externalValidation(playerData, profile, topic, meta, original)
  else completeSubmission(profile, meta, -1, original)
  return true
}

function externalValidation(playerData, profile, topic, meta, original) {
  Player.setMetadata(REQUEST_METADATA_KEY, new FixedMetadataValue(papi, true))

  var f0 = CompletableFuture.supplyAsync(() => {
    var status = getValidationStatus(getValidationPayload(topic, meta))
    return Object.keys(ASYNC_MESSAGES)[status]
  }, scheduleAsync)

  var f1 = CompletableFuture.supplyAsync(() => {
    var pages = sanitize(meta.pages.stream()
      .collect(Collectors.joining(" ")))
    return getSaplingScore(pages) * 100
  }, scheduleAsync)

  f0.thenCombine(f1, (status, score) => ({ status, score }))
    .whenCompleteAsync((result, exception) => {
      Player.removeMetadata(REQUEST_METADATA_KEY, papi)
      if (exception != null || result.status == undefined) 
        return enableRetry(playerData, profile, "Server Error", SUBMISSION_OBJ_ID)
      if (result.status != "VALID_INPUT") 
        return enableRetry(playerData, profile, ASYNC_MESSAGES[result.status], SUBMISSION_OBJ_ID)
      completeSubmission(profile, meta, result.score, original)
    }, schedule)

}

function completeSubmission(profile, meta, score, original) {
  var path = `library.${BukkitPlayer.uniqueId}`
  var old = Metadata.globalData.getList(path), data = new ArrayList()
  if (old != null) data.addAll(old)
  BetonQuest.event(profile, new EventID(null, "Eleanor.complete_quest"));
  data.add({ title: meta.title, pages: meta.pages, timestamp: Date.now(), ai_score: score })
  Metadata.globalData.set(path, data)
  original.amount -= 1
}

function enableRetry(playerData, profile, error, objID) {
  var varObj = BETON_INSTANCE.getObjective(new ObjectiveID(null, "Eleanor.var_objective"))
  varObj.store(profile, "error", error)
  BetonQuest.event(profile, new EventID(null, "Eleanor.error"));
  if (profile.getOnlineProfile().isPresent()) BetonQuest.newObjective(profile, objID)
  else playerData.addNewRawObjective(objID);
  return error
}

function showBook(id, index) {
  var data = Metadata.globalData.get(`library.${id}`)
  if (data == null) return false
  var uuid = UUID.fromString(id), book = data.get(index) 
  var stack = new ItemStack(Material.WRITTEN_BOOK)
  stack.editMeta(function (meta) {
    meta.title = book.get("title")
    meta.author = BukkitServer.getPlayer(uuid).name
    meta.pages = book.get("pages")
  })
  BukkitPlayer.openBook(stack)
  return true
}

function getValidationStatus(payload) {
  var request = new HttpPost("https://api.groq.com/openai/v1/chat/completions")
  request.addHeader("Content-Type", "application/json")
  request.addHeader("Authorization", `Bearer ${GROQ_API_TOKEN}`)
  request.setEntity(new StringEntity(payload));
  var response = postRequest(request)
  return response.hasOwnProperty("choices") 
    ? response.choices[0].message.content : -1
}

function getSaplingScore(pages) {
  var request = new HttpPost("https://api.sapling.ai/api/v1/aidetect")
  request.addHeader("Content-Type", "application/json")
  request.setEntity(new StringEntity(`{"key":"${SAPPLING_API_TOKEN}", "text":"${pages}", "sent_scores": false}`));
  var response = postRequest(request)
  return response.hasOwnProperty("score") 
    ? response.score : 0
}

function postRequest(request) {
  var httpClient = HttpClients.custom()
    .setDefaultRequestConfig(RequestConfig.custom()
        .setConnectTimeout(3000)
        .setCookieSpec(CookieSpecs.STANDARD)
        .build())
    .build();
  var response = undefined;
  try {
    response = httpClient.execute(request)
    return JSON.parse(EntityUtils.toString(response.getEntity()))
  } catch (_) { return {} } 
  finally {
    httpClient.close()
    response.close()
  }
}

function stripColor(text) {
  try {
    var component = JSONComponentSerializer.json().deserialize(text)
    return PlainTextComponentSerializer.plainText().serialize(component)
  } catch (_) { return ChatColor.stripColor(text) }
}

function scheduleAsync(runnable) { 
  BukkitServer.getScheduler().runTaskAsynchronously(papi, runnable) 
}

function schedule(runnable) { 
  BukkitServer.getScheduler().runTask(papi, runnable) 
}

function getValidationPayload(topic, meta) {
  return `
    {
      "messages": [ 
        ${ getSystemMessage(topic) },
        ${ getUserMessage(topic, stripColor(meta.title), meta.pages) }
      ],
     "model": "llama3-70b-8192",
     "temperature": 0.5,
     "max_tokens": 1
    }
  `
}

function getSystemMessage(topic) {
  var options = Object.keys(ASYNC_MESSAGES).map((k, i) => `${i}=${k}`).join(" | ")
  var content = sanitize(`
    <instruction>
      You are an expert story validator evaluating whether the story meets the required criteria.
      As you review the story, focus on the following aspects
    </instruction>

    <requirements>
      <r>Verify that the story and title aligns with the specified topic 
        <topic>${ topic }</topic>
      </r>
      <r>Ensure that the story and title contains no curses.</r>
    </requirements>

    <note>
      After reviewing the story, your response should ONLY include one of the following integers
      <important> ${ options } </important>
    </note>
  `)
  return `{ "role": "system", "content": "${content}" }`
}

function getUserMessage(topic, title, pages) {
  var pages = pages.stream().map(p => `<page>${p}</page>`)
    .collect(Collectors.joining())
  var content = sanitize(`
    <topic>${ topic }</topic>
    <title>${ title }</title>
    <pages>${ pages }</pages>
  `)
  return `{ "role": "user", "content": "${content}" }`
}

function sanitize(input) {
  return input.replace(ESCAPE_REGEX, (match) => {
    switch (match) {
      case '\"': return '\\"';
      default: return " "; 
    }
  })
} 

main()
