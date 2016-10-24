﻿using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Newtonsoft.Json;

namespace TwitterWall.Models
{
    public class Tweet
    {
        public Tweet ()
        {

        }

        public Tweet(long tweetId, string body, string handle, DateTime date, string name, string profileImage, Event ev, long userId)
        {
            this.TweetId = tweetId;
            this.Body = body;
            this.Handle = handle;
            this.Date = date;
            this.Name = name;
            this.ProfileImage = profileImage;
            this.Event = ev;
            this.UserId = userId;
        }

        [Key]
        [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
        public int Id { get; set; }
        public long TweetId { get; set; }
        public string Body { get; set; }
        public string Handle { get; set; }
        public DateTime Date { get; set; }
        public string Name { get; set; }
        public string ProfileImage { get; set; }
        public Event Event { get; set; }
        public long UserId { get; set; }

        public ICollection<MediaUrl> MediaList { get; set; }
        public ICollection<Sticky> StickyList { get; set; }
    }
}
