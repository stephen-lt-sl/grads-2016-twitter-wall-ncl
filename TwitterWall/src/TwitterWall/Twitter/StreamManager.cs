﻿using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using TwitterWall.Models;
using TwitterWall.Repository;
using TwitterWall.Utility;

namespace TwitterWall.Twitter
{
    class StreamManager
    {
        private static StreamManager _instance;

        private EventDBRepository _eventRepo = new EventDBRepository();

        private Dictionary<string, TwitterStream> streams = new Dictionary<string, TwitterStream>();

        public List<UserCredential> Users = new List<UserCredential>();

        private const string CONSUMER_KEY = "CONSUMER_KEY";
        private const string CONSUMER_SECRET = "CONSUMER_SECRET";
        private const string ACCESS_TOKEN = "ACCESS_TOKEN";
        private const string ACCESS_TOKEN_SECRET = "ACCESS_TOKEN_SECRET";
        private const string CREDENTIALS_PROPERTY = "TwitterCredentials";

        public string ConsumerKey { get; set; }
        public string ConsumerSecret { get; set; }
        public string AccessToken { get; set; }
        public string AccessTokenSecret { get; set; }

        protected StreamManager()
        {
            RetrieveCredentials();
        }

        public void SetupManager()
        {
            foreach (Event ev in _eventRepo.GetAll())
            {
                SetupStream(ev);
            }
        }

        private void SetupStream(Event e)
        {
            TwitterStream stream = new TwitterStream(e, ConsumerKey, ConsumerSecret, AccessToken, AccessTokenSecret);
            stream.ConfigureStream();
            streams.Add(e.Name, stream);
        }

        public TwitterStream GetStream(string streamName)
        {
            if (!String.IsNullOrEmpty(streamName))
            {
                TwitterStream ts;
                streams.TryGetValue(streamName, out ts);
                return ts;
            }
            return null;
        }

        private static readonly Lazy<StreamManager> instance = new Lazy<StreamManager>(() => new StreamManager());

        public static StreamManager Instance()
        {
            return instance.Value;
        }

        public void AddUserCredentials(UserCredential user)
        {
            UserCredential uc;
            if ((uc = Users.Find(u => u.Handle == user.Handle)) == null)
            {
                Users.Add(user);
            }
            else
            {
                Users.Remove(uc);
                Users.Add(user);
            }
        }

        private void RetrieveCredentials()
        {
            this.ConsumerKey = Environment.GetEnvironmentVariable(CONSUMER_KEY);
            this.ConsumerSecret = Environment.GetEnvironmentVariable(CONSUMER_SECRET);
            this.AccessToken = Environment.GetEnvironmentVariable(ACCESS_TOKEN);
            this.AccessTokenSecret = Environment.GetEnvironmentVariable(ACCESS_TOKEN_SECRET);

            if (String.IsNullOrEmpty(ConsumerKey) || String.IsNullOrEmpty(ConsumerSecret) || String.IsNullOrEmpty(AccessToken) || String.IsNullOrEmpty(AccessTokenSecret))
            {
                dynamic result = JObject.Parse(JsonParser.GetConfig()[CREDENTIALS_PROPERTY].ToString());
                this.ConsumerKey = result[CONSUMER_KEY];
                this.ConsumerSecret = result[CONSUMER_SECRET];
                this.AccessToken = result[ACCESS_TOKEN];
                this.AccessTokenSecret = result[ACCESS_TOKEN_SECRET];
            }
        }

        public bool ChangeUserCredentials(string handle, string hash, string eventName)
        {
            UserCredential uc = Users.Find(u => u.Handle == handle);
            if (uc != null && uc.VerifyHash(hash))
            {
                TwitterStream ts = GetStream(eventName);
                ts.AccessToken = uc.GetAccessToken();
                ts.AccessTokenSecret = uc.GetAccessSecret();
                ts.UpdateCredentials();
                return true;
            }
            return false;
        }

        public void AddEvent(string name)
        {
            Event ev = new Event();
            ev.Name = name;
            _eventRepo.Add(ev);
            SetupStream(ev);
        }

        public void RemoveEvent(int eventId)
        {
            Event ev = _eventRepo.Find(e => e.Id == eventId).SingleOrDefault();
            if (ev != null)
            {
                TwitterStream ts = GetStream(ev.Name);
                if (ts != null)
                {
                    ts.Stop();
                    streams.Remove(ev.Name);
                    _eventRepo.Remove(ev.Id);
                }
            }
        }
    }
}