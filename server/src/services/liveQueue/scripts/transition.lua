local approvedKey = KEYS[1]
local nowPlayingKey = KEYS[2]
local versionKey = KEYS[3]
local resultKey = KEYS[4]
local eventStreamKey = KEYS[5]
local doneKey = KEYS[6]
local songPrefix = ARGV[1]
local roomId = ARGV[2]
local eventId = ARGV[3]
local createdAt = tonumber(ARGV[4])

local cached = redis.call('GET', resultKey)
if cached then return cached end

local oldTrackId = redis.call('GET', nowPlayingKey)
local nextTrackId = redis.call('LPOP', approvedKey)
local oldTrack = nil
local nextTrack = nil

if oldTrackId then
  oldTrack = cjson.decode(redis.call('GET', songPrefix .. oldTrackId) or '{}')
  oldTrack.status = 'done'
  redis.call('SET', songPrefix .. oldTrackId, cjson.encode(oldTrack))
  redis.call('LPUSH', doneKey, oldTrackId)
end

if nextTrackId then
  nextTrack = cjson.decode(redis.call('GET', songPrefix .. nextTrackId) or '{}')
  nextTrack.status = 'playing'
  redis.call('SET', songPrefix .. nextTrackId, cjson.encode(nextTrack))
  redis.call('SET', nowPlayingKey, nextTrackId)
else
  redis.call('DEL', nowPlayingKey)
end

local upNextId = redis.call('LINDEX', approvedKey, 0)
local upNext = nil
if upNextId then upNext = cjson.decode(redis.call('GET', songPrefix .. upNextId) or '{}') end

local version = redis.call('INCR', versionKey)
local event = cjson.encode({
  eventId = eventId,
  type = 'track_transitioned',
  roomId = roomId,
  payload = {
    oldTrackId = oldTrackId,
    nextTrackId = nextTrackId,
    transitionedAt = createdAt
  },
  createdAt = createdAt
})
redis.call('XADD', eventStreamKey, '*', 'event', event)

local result = cjson.encode({
  oldTrackId = oldTrackId or cjson.null,
  nextTrack = nextTrack or cjson.null,
  upNext = upNext or cjson.null,
  queueVersion = version
})
redis.call('SET', resultKey, result, 'EX', 60)
return result
