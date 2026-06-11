local pendingKey = KEYS[1]
local approvedKey = KEYS[2]
local versionKey = KEYS[3]
local eventStreamKey = KEYS[4]
local songKey = KEYS[5]
local roomId = ARGV[1]
local songId = ARGV[2]
local eventId = ARGV[3]
local createdAt = tonumber(ARGV[4])

local songJson = redis.call('GET', songKey)
if not songJson then return cjson.encode({ ok = false, error = 'missing_song' }) end

local song = cjson.decode(songJson)
if song.status ~= 'pending' then return cjson.encode({ ok = false, error = 'not_pending' }) end

redis.call('LREM', pendingKey, 1, songId)
song.status = 'approved'
song.approvedAt = createdAt
redis.call('SET', songKey, cjson.encode(song))
redis.call('RPUSH', approvedKey, songId)

local version = redis.call('INCR', versionKey)
local event = cjson.encode({
  eventId = eventId,
  type = 'song_approved',
  roomId = roomId,
  songId = songId,
  payload = { approvedAt = createdAt },
  createdAt = createdAt
})
redis.call('XADD', eventStreamKey, '*', 'event', event)

return cjson.encode({ ok = true, song = song, queueVersion = version })
