local songKey = KEYS[1]
local versionKey = KEYS[2]
local eventStreamKey = KEYS[3]

local roomId = ARGV[1]
local songId = ARGV[2]
local title = ARGV[3]
local eventId = ARGV[4]
local createdAt = ARGV[5]

local songJson = redis.call('GET', songKey)
if not songJson then
  return cjson.encode({ ok = false, error = 'missing_song' })
end

local song = cjson.decode(songJson)
song.title = title
redis.call('SET', songKey, cjson.encode(song))
local version = redis.call('INCR', versionKey)

local event = cjson.encode({
  eventId = eventId,
  type = 'song_updated',
  roomId = roomId,
  songId = songId,
  payload = { title = title },
  createdAt = tonumber(createdAt)
})
redis.call('XADD', eventStreamKey, '*', 'event', event)

return cjson.encode({ ok = true, song = song, queueVersion = version })
