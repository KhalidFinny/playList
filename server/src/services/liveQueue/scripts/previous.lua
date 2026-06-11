local approvedKey = KEYS[1]
local doneKey = KEYS[2]
local nowPlayingKey = KEYS[3]
local versionKey = KEYS[4]
local eventStreamKey = KEYS[5]

local songPrefix = ARGV[1]
local roomId = ARGV[2]
local eventId = ARGV[3]
local createdAt = tonumber(ARGV[4])

local previousTrackId = redis.call('LPOP', doneKey)
if not previousTrackId then
  return cjson.encode({ ok = false, error = 'no_previous_track' })
end

local currentTrackId = redis.call('GET', nowPlayingKey)
local currentTrack = nil
if currentTrackId then
  currentTrack = cjson.decode(redis.call('GET', songPrefix .. currentTrackId) or '{}')
  currentTrack.status = 'approved'
  redis.call('SET', songPrefix .. currentTrackId, cjson.encode(currentTrack))
  redis.call('RPUSH', approvedKey, currentTrackId)
end

local previousTrack = cjson.decode(redis.call('GET', songPrefix .. previousTrackId) or '{}')
previousTrack.status = 'playing'
redis.call('SET', songPrefix .. previousTrackId, cjson.encode(previousTrack))
redis.call('SET', nowPlayingKey, previousTrackId)

local version = redis.call('INCR', versionKey)
local event = cjson.encode({
  eventId = eventId,
  type = 'track_previous',
  roomId = roomId,
  payload = {
    currentTrackId = currentTrackId,
    previousTrackId = previousTrackId,
    changedAt = createdAt
  },
  createdAt = createdAt
})
redis.call('XADD', eventStreamKey, '*', 'event', event)

return cjson.encode({
  ok = true,
  previousTrack = previousTrack,
  returnedTrack = currentTrack or cjson.null,
  queueVersion = version
})
