local pendingKey = KEYS[1]
local approvedKey = KEYS[2]
local doneKey = KEYS[3]
local nowPlayingKey = KEYS[4]
local versionKey = KEYS[5]
local eventStreamKey = KEYS[6]
local songKey = KEYS[7]

local roomId = ARGV[1]
local songId = ARGV[2]
local eventId = ARGV[3]
local createdAt = ARGV[4]

local songJson = redis.call('GET', songKey)
if not songJson then
  return cjson.encode({ ok = false, error = 'missing_song' })
end

local song = cjson.decode(songJson)
redis.call('LREM', pendingKey, 0, songId)
redis.call('LREM', approvedKey, 0, songId)
redis.call('LREM', doneKey, 0, songId)

if redis.call('GET', nowPlayingKey) == songId then
  redis.call('DEL', nowPlayingKey)
end

redis.call('DEL', songKey)
local version = redis.call('INCR', versionKey)

local event = cjson.encode({
  eventId = eventId,
  type = 'song_deleted',
  roomId = roomId,
  songId = songId,
  payload = { previousStatus = song.status },
  createdAt = tonumber(createdAt)
})
redis.call('XADD', eventStreamKey, '*', 'event', event)

return cjson.encode({ ok = true, song = song, queueVersion = version })
