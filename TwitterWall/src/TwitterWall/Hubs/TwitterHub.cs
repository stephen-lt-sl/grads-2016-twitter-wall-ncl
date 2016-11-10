using Microsoft.AspNetCore.SignalR;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using TwitterWall.Models;
using TwitterWall.Repository;
using TwitterWall.Twitter;
using TwitterWall.Utility;

namespace TwitterWall.Hubs
{
    public class TwitterHub : Hub
    {
        private EventDBRepository _eventRepo;
        private StreamManager streamManager;

        public TwitterHub(StreamManager manager, EventDBRepository repo)
        {
            _eventRepo = repo;
            streamManager = manager;
        }

        public Task JoinGroup(string groupName)
        {
            return Groups.Add(Context.ConnectionId, groupName);
        }

        public void ToggleSticky(long tweetId, string streamName)
        {
            TwitterStream ts = streamManager.GetStream(streamName);
            if (ts != null)
            {
                ts._tweetRepo.ToggleSticky(tweetId);
                ts.UpdateTweet(tweetId);
                TweetUpdate(ts._tweetRepo.Find(t => t.Id == tweetId && t.Event.Name == streamName).SingleOrDefault(), streamName);
            }
        }

        public void AddTrack(string keyword, string streamName)
        {
            TwitterStream ts = streamManager.GetStream(streamName);
            if (ts != null)
            {
                ts.AddTrack(keyword);
                GetTracks(streamName);
            }
        }

        public void RemoveTrack(int id, string streamName)
        {
            TwitterStream ts = streamManager.GetStream(streamName);
            if (ts != null)
            {
                ts.RemoveTrack(id);
                GetTracks(streamName);
            }
        }

        public void FollowUser(string handle, string streamName)
        {
            TwitterStream ts = streamManager.GetStream(streamName);
            if (ts != null)
            {
                if (!ts.AddPriorityUser(handle))
                {
                    Clients.Caller.invalidUser("That user does not exist!");
                }
                else
                {
                    GetPriorityUsers(streamName);
                }
            }
        }

        public void RemovePriorityUser(int id, string streamName)
        {
            TwitterStream ts = streamManager.GetStream(streamName);
            if (ts != null)
            {
                Subscription subscription = ts._subRepo.Find(sub => sub.Id == id && streamName == sub.Event.Name).First();
                if (subscription != null)
                {
                    ts.RemoveSubscription(id);
                    GetPriorityUsers(streamName);
                }
            }
        }

        public void RemoveTweet(long id, string streamName)
        {
            TwitterStream ts = streamManager.GetStream(streamName);
            if (ts != null)
            {
                ts._tweetRepo.Remove(id);
                ts.RemoveTweet(id);
                Clients.Group(streamName).tweetRemoved(id);
            }
        }

        public void GetTracks(string streamName)
        {
            TwitterStream ts = streamManager.GetStream(streamName);
            if (ts != null)
            {
                List<Subscription> l = ts.GetTracks();
                Clients.Group(streamName).receiveTracks(ts.GetTracks());
            }
        }

        public void GetPriorityUsers(string streamName)
        {
            TwitterStream ts = streamManager.GetStream(streamName);
            if (ts != null)
            {
                Clients.Group(streamName).receiveUsers(ts.GetPriorityUsers());
            }
        }

        public void GetBannedUsers(string streamName)
        {
            TwitterStream ts = streamManager.GetStream(streamName);
            if (ts != null)
            {
                Clients.Group(streamName).receiveBannedUsers(ts.GetBannedUsers());
            }
        }

        public void RestartStream(string streamName)
        {
            TwitterStream ts = streamManager.GetStream(streamName);
            if (ts != null)
            {
                ts.Restart();
            }
        }

        public void RemoveTweetImage(long imageId, string streamName)
        {
            TwitterStream ts = streamManager.GetStream(streamName);
            if (ts != null)
            {
                MediaUrl media = ts._mediaRepo.Find(m => m.Id == imageId).SingleOrDefault();
                if (media != null)
                {
                    ts._mediaRepo.SetVisibility(imageId, false);
                    Tweet tweet = ts._tweetRepo.Find(t => t.Id == media.Tweet.Id).SingleOrDefault();
                    if (tweet != null)
                    {
                        ts.UpdateTweet(media.Tweet.Id);
                        TweetUpdate(tweet, streamName);
                    }
                }
            }
        }

        public void TweetUpdate(Tweet tweet, string streamName)
        {
            if (tweet != null)
            {
                Clients.Group(streamName).tweetChanged(tweet);
            }
        }

        public void GetStreamStatus(string streamName)
        {
            TwitterStream ts = streamManager.GetStream(streamName);
            if (ts != null)
            {
                Clients.Caller.streamStatusChanged(ts.StreamStatus().ToString());
            }
        }

        public void AddEvent(string name)
        {
            streamManager.AddEvent(name);
            SendEvents();
        }

        public void RemoveEvent(int eventId)
        {
            streamManager.RemoveEvent(eventId);
            SendEvents();
        }

        private void SendEvents()
        {
            Clients.Caller.receiveEvents(_eventRepo.GetAll());
        }

        public void BanUser(Tweet tweet, string streamName)
        {
            TwitterStream ts = streamManager.GetStream(streamName);
            if (ts != null)
            {
                Tweet serverTweet = ts._tweetRepo.Find(t => t.Id == tweet.Id && t.Event.Name == streamName).SingleOrDefault();
                User alreadyBanned = ts._userRepo.Find(user => user.UserId == serverTweet.UserId && user.Event.Name == streamName).SingleOrDefault();
                if (alreadyBanned == null && serverTweet != null)
                {
                    User newUser = new User(serverTweet.UserId, serverTweet.Handle);
                    newUser.Type = Common.BanType;
                    newUser.Event = ts.GetStreamEvent();
                    ts._userRepo.Add(newUser);
                    List<Tweet> tweetsToDelete = ts._tweetRepo.Find(t => (t.UserId == serverTweet.UserId) && (t.Event.Name == streamName)).ToList();
                    foreach (Tweet aTweet in tweetsToDelete)
                    {
                        RemoveTweet(aTweet.Id, streamName);
                    }
                    Clients.Group(streamName).userBanned(ts.GetBannedUsers());
                    ts.RemoveTweetsByHandle(newUser.Handle);
                }
            }
        }

        public void RemoveBannedUser(int bannedUserId, string streamName)
        {
            TwitterStream ts = streamManager.GetStream(streamName);
            if (ts != null)
            {
                User bannedUser = ts._userRepo.Find(u => u.Id == bannedUserId && u.Event.Name == streamName).SingleOrDefault();
                if (bannedUser != null)
                {
                    ts._userRepo.Remove(bannedUserId);
                    GetBannedUsers(streamName);
                }
            }
        }
    }
}