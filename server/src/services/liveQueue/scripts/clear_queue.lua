local pendingKey = KEYS[1]
local approvedKey = KEYS[2]
local nowPlayingKey = KEYS[3]
local versionKey = KEYS[4]
local eventStreamKey = KEYS[5]
local roomId = ARGV[1]
local eventId = ARGV[2]
local createdAt = tonumber(ARGV[3])

-- Get all song IDs from pending and approved lists
local allIds = {}
local pendingIds = redis.call('LRANGE', pendingKey, 0, -1)
local approvedIds = redis.call('LRANGE', approvedKey, 0, -1)
for _, id in ipairs(pendingIds) do table.insert(allIds, id) end
for _, id in ipairs(approvedIds) do table.insert(allIds, id) end

-- Delete all song data
for _, id in ipairs(allIds) do
  redis.call('DEL', 'song:' .. id)
end

-- Clear the lists and nowPlaying
redis.call('DEL', pendingKey)
redis.call('DEL', approvedKey)
redis.call('DEL', nowPlayingKey)

local version = redis.call('INCR', versionKey)
local event = cjson.encode({
  eventId = eventId,
  type = 'queue_cleared',
  roomId = roomId,
  payload = { clearedAt = createdAt },
  createdAt = createdAt
})
redis.call('XADD', eventStreamKey, '*', 'event', event)

return cjson.encode({ ok = true, clearedCount = #allIds, queueVersion = version })
